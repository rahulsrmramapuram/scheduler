let selectedAlgorithm = "FCFS";
let processCount = 0;
let comparisonChart = null;

const body = document.getElementById("processBody");
const resultBody = document.getElementById("resultBody");
const errorBanner = document.getElementById("errorBanner");

const colors = [
    "rgba(139, 92, 246, 0.35)",  // Purple
    "rgba(34, 211, 238, 0.35)",  // Cyan
    "rgba(52, 211, 153, 0.35)",  // Emerald
    "rgba(251, 146, 60, 0.35)",  // Orange
    "rgba(244, 63, 94, 0.35)",   // Rose
    "rgba(250, 204, 21, 0.35)",  // Yellow
    "rgba(168, 85, 247, 0.35)",  // Indigo
    "rgba(236, 72, 153, 0.35)"   // Pink
];

function getProcessColor(pid) {
    if (pid === "IDLE") return "rgba(255, 255, 255, 0.04)";
    let hash = 0;
    for (let i = 0; i < pid.length; i++) hash += pid.charCodeAt(i);
    return colors[hash % colors.length];
}

function showError(msg) {
    if (errorBanner) {
        errorBanner.textContent = "⚠️ " + msg;
        errorBanner.style.display = "block";
    }
}

function clearError() {
    if (errorBanner) {
        errorBanner.textContent = "";
        errorBanner.style.display = "none";
    }
}

function addProcess(id, arrival = 0, burst = 5) {
    processCount++;
    const pid = id || `P${processCount}`;

    const row = document.createElement("tr");
    row.innerHTML = `
        <td><input class="process-input pid" value="${pid}"></td>
        <td><input class="process-input arrival" type="number" min="0" value="${arrival}"></td>
        <td><input class="process-input burst" type="number" min="1" value="${burst}"></td>
        <td><button class="delete" title="Remove">×</button></td>
    `;
    row.querySelector(".delete").onclick = () => {
        row.remove();
        clearError();
    };
    body.appendChild(row);
}

function getProcesses() {
    const rows = [...body.querySelectorAll("tr")];
    const processes = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const pidInput = row.querySelector(".pid");
        const arrInput = row.querySelector(".arrival");
        const burstInput = row.querySelector(".burst");

        const pid = pidInput.value.trim() || `P${i + 1}`;
        const arrivalVal = arrInput.value.trim();
        const burstVal = burstInput.value.trim();

        if (arrivalVal === "" || isNaN(arrivalVal) || Number(arrivalVal) < 0) {
            throw new Error(`Row ${i + 1}: Arrival time must be a non-negative number.`);
        }
        if (burstVal === "" || isNaN(burstVal) || Number(burstVal) <= 0) {
            throw new Error(`Row ${i + 1}: Burst time must be a positive integer greater than 0.`);
        }

        processes.push({
            id: pid,
            arrival: Math.floor(Number(arrivalVal)),
            burst: Math.floor(Number(burstVal))
        });
    }

    return processes;
}

document.querySelectorAll(".algo").forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll(".algo").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
        selectedAlgorithm = btn.dataset.algo;
        document.getElementById("quantumRow").style.opacity = selectedAlgorithm === "RR" ? "1" : ".55";
        clearError();
    };
});

async function simulate() {
    clearError();
    const simBtn = document.getElementById("simulate");

    try {
        const processes = getProcesses();
        if (!processes.length) {
            showError("Please add at least one process to run the simulation.");
            return;
        }

        let quantum = 2;
        if (selectedAlgorithm === "RR") {
            const qVal = document.getElementById("quantum").value.trim();
            if (qVal === "" || isNaN(qVal) || Number(qVal) <= 0) {
                showError("Time quantum for Round Robin must be an integer greater than 0.");
                return;
            }
            quantum = Math.floor(Number(qVal));
        }

        simBtn.disabled = true;
        simBtn.textContent = "Simulating...";

        const response = await fetch("/api/simulate", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                algorithm: selectedAlgorithm,
                quantum: quantum,
                processes: processes
            })
        });

        const data = await response.json();
        if (!response.ok) {
            showError(data.error || "Simulation failed.");
            return;
        }

        document.getElementById("avgWaiting").textContent = data.metrics.avg_waiting;
        document.getElementById("avgTurnaround").textContent = data.metrics.avg_turnaround;
        document.getElementById("cpuUtil").textContent = data.metrics.cpu_utilization + "%";
        document.getElementById("switches").textContent = data.metrics.context_switches;

        document.getElementById("chartSubtitle").textContent =
            `${data.algorithm}${data.quantum ? ` · Quantum ${data.quantum}` : ""} · CPU timeline`;

        renderGantt(data.timeline);
        renderResults(data.results);
    } catch (err) {
        showError(err.message || "An unexpected error occurred.");
    } finally {
        simBtn.disabled = false;
        simBtn.textContent = "Run Simulation →";
    }
}

function renderGantt(timeline) {
    const gantt = document.getElementById("gantt");
    gantt.classList.remove("empty");
    gantt.innerHTML = "";

    if (!timeline || !timeline.length) {
        gantt.classList.add("empty");
        gantt.textContent = "No timeline generated.";
        return;
    }

    timeline.forEach(item => {
        const duration = item.end - item.start;
        if (duration <= 0) return;

        const el = document.createElement("div");
        el.className = "gantt-item" + (item.pid === "IDLE" ? " idle" : "");
        el.style.flex = `${duration} 1 0%`;
        el.style.backgroundColor = getProcessColor(item.pid);

        el.innerHTML = `
            <b>${item.pid}</b>
            <small>${item.start} → ${item.end}</small>
        `;
        gantt.appendChild(el);
    });
}

function renderResults(results) {
    resultBody.innerHTML = "";
    results.forEach(p => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><b>${p.id}</b></td>
            <td>${p.arrival}</td>
            <td>${p.burst}</td>
            <td>${p.completion}</td>
            <td>${p.turnaround}</td>
            <td>${p.waiting}</td>
            <td>${p.response}</td>
        `;
        resultBody.appendChild(row);
    });
}

async function compareAlgorithms() {
    clearError();
    const compareBtn = document.getElementById("compare");

    try {
        const processes = getProcesses();
        if (!processes.length) {
            showError("Please add at least one process to compare algorithms.");
            return;
        }

        const qVal = document.getElementById("quantum").value.trim();
        const quantum = (qVal && !isNaN(qVal) && Number(qVal) > 0) ? Math.floor(Number(qVal)) : 2;

        compareBtn.disabled = true;
        compareBtn.textContent = "Comparing...";

        const response = await fetch("/api/compare", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                quantum: quantum,
                processes: processes
            })
        });

        const data = await response.json();
        if (!response.ok) {
            showError(data.error || "Comparison failed.");
            return;
        }

        const labels = ["FCFS", "SJN", "RR"];
        const waiting = labels.map(x => data[x].avg_waiting);
        const turnaround = labels.map(x => data[x].avg_turnaround);

        if (comparisonChart) comparisonChart.destroy();

        comparisonChart = new Chart(document.getElementById("comparisonChart"), {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {label: "Average Waiting", data: waiting, backgroundColor: "rgba(139, 92, 246, 0.75)"},
                    {label: "Average Turnaround", data: turnaround, backgroundColor: "rgba(34, 211, 238, 0.75)"}
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {labels: {color: "#cbd5e1"}}
                },
                scales: {
                    x: {ticks: {color: "#8993a8"}, grid: {color: "#263047"}},
                    y: {ticks: {color: "#8993a8"}, grid: {color: "#263047"}, beginAtZero: true}
                }
            }
        });
    } catch (err) {
        showError(err.message || "An unexpected error occurred during comparison.");
    } finally {
        compareBtn.disabled = false;
        compareBtn.textContent = "Compare Algorithms";
    }
}

document.getElementById("addProcess").onclick = () => addProcess();
document.getElementById("simulate").onclick = simulate;
document.getElementById("compare").onclick = compareAlgorithms;

document.getElementById("loadDemo").onclick = () => {
    clearError();
    body.innerHTML = "";
    processCount = 0;
    addProcess("P1", 0, 7);
    addProcess("P2", 1, 4);
    addProcess("P3", 2, 1);
    addProcess("P4", 3, 5);
    addProcess("P5", 4, 2);
};

addProcess("P1", 0, 7);
addProcess("P2", 1, 4);
addProcess("P3", 2, 1);
addProcess("P4", 3, 5);


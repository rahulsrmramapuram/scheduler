from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

def fcfs(processes):
    procs = sorted(processes, key=lambda x: (x["arrival"], x["id"]))
    time = 0
    timeline = []
    results = []

    for p in procs:
        if time < p["arrival"]:
            timeline.append({"pid": "IDLE", "start": time, "end": p["arrival"]})
            time = p["arrival"]

        start = time
        end = time + p["burst"]
        timeline.append({"pid": p["id"], "start": start, "end": end})
        time = end

        results.append({
            "id": p["id"],
            "arrival": p["arrival"],
            "burst": p["burst"],
            "completion": end,
            "turnaround": end - p["arrival"],
            "waiting": start - p["arrival"],
            "response": start - p["arrival"]
        })

    return results, timeline


def sjn(processes):
    remaining = sorted(processes, key=lambda x: (x["arrival"], x["id"]))
    completed = []
    timeline = []
    time = 0

    while remaining:
        available = [p for p in remaining if p["arrival"] <= time]

        if not available:
            next_arrival = min(p["arrival"] for p in remaining)
            timeline.append({"pid": "IDLE", "start": time, "end": next_arrival})
            time = next_arrival
            continue

        p = min(available, key=lambda x: (x["burst"], x["arrival"], x["id"]))
        remaining.remove(p)

        start = time
        end = time + p["burst"]
        timeline.append({"pid": p["id"], "start": start, "end": end})
        time = end

        completed.append({
            "id": p["id"],
            "arrival": p["arrival"],
            "burst": p["burst"],
            "completion": end,
            "turnaround": end - p["arrival"],
            "waiting": start - p["arrival"],
            "response": start - p["arrival"]
        })

    return completed, timeline


def round_robin(processes, quantum):
    procs = sorted(processes, key=lambda x: (x["arrival"], x["id"]))
    remaining = {i: p["burst"] for i, p in enumerate(procs)}
    first_start = {}
    completion = {}
    queue = []
    timeline = []
    time = 0
    i = 0

    while i < len(procs) or queue:
        if not queue:
            if i < len(procs) and time < procs[i]["arrival"]:
                timeline.append({"pid": "IDLE", "start": time, "end": procs[i]["arrival"]})
                time = procs[i]["arrival"]

            while i < len(procs) and procs[i]["arrival"] <= time:
                queue.append((i, procs[i]))
                i += 1

        if not queue:
            break

        idx, p = queue.pop(0)
        pid = p["id"]

        if idx not in first_start:
            first_start[idx] = time

        run = min(quantum, remaining[idx])
        start = time
        time += run
        remaining[idx] -= run

        timeline.append({"pid": pid, "start": start, "end": time})

        while i < len(procs) and procs[i]["arrival"] <= time:
            queue.append((i, procs[i]))
            i += 1

        if remaining[idx] > 0:
            queue.append((idx, p))
        else:
            completion[idx] = time

    results = []
    for idx, p in enumerate(procs):
        c = completion.get(idx, time)
        results.append({
            "id": p["id"],
            "arrival": p["arrival"],
            "burst": p["burst"],
            "completion": c,
            "turnaround": c - p["arrival"],
            "waiting": c - p["arrival"] - p["burst"],
            "response": first_start.get(idx, p["arrival"]) - p["arrival"]
        })

    return results, timeline


def merge_timeline(timeline):
    if not timeline:
        return timeline
    merged = [timeline[0].copy()]
    for item in timeline[1:]:
        last = merged[-1]
        if last["pid"] == item["pid"] and last["end"] == item["start"]:
            last["end"] = item["end"]
        else:
            merged.append(item.copy())
    return merged


def metrics(results, timeline):
    n = len(results)
    avg_waiting = sum(p["waiting"] for p in results) / n if n else 0
    avg_turnaround = sum(p["turnaround"] for p in results) / n if n else 0
    avg_response = sum(p["response"] for p in results) / n if n else 0

    total_time = timeline[-1]["end"] if timeline else 0
    busy_time = sum(x["end"] - x["start"] for x in timeline if x["pid"] != "IDLE")
    cpu_utilization = (busy_time / total_time * 100) if total_time else 0

    context_switches = max(0, len([x for x in timeline if x["pid"] != "IDLE"]) - 1)

    return {
        "avg_waiting": round(avg_waiting, 2),
        "avg_turnaround": round(avg_turnaround, 2),
        "avg_response": round(avg_response, 2),
        "cpu_utilization": round(cpu_utilization, 2),
        "context_switches": context_switches
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.post("/api/simulate")
def simulate():
    data = request.get_json()
    processes = data.get("processes", [])
    algorithm = data.get("algorithm", "FCFS").upper()
    quantum = int(data.get("quantum", 2))

    if not processes:
        return jsonify({"error": "Add at least one process."}), 400

    normalized = []
    for i, p in enumerate(processes):
        try:
            arrival = max(0, int(p["arrival"]))
            burst = int(p["burst"])
            if burst <= 0:
                raise ValueError
        except (KeyError, ValueError, TypeError):
            return jsonify({"error": f"Invalid process data at row {i + 1}."}), 400

        normalized.append({
            "id": str(p.get("id") or f"P{i + 1}"),
            "arrival": arrival,
            "burst": burst
        })

    if algorithm == "FCFS":
        results, timeline = fcfs(normalized)
    elif algorithm == "SJN":
        results, timeline = sjn(normalized)
    elif algorithm == "RR":
        if quantum <= 0:
            return jsonify({"error": "Time quantum must be greater than 0."}), 400
        results, timeline = round_robin(normalized, quantum)
    else:
        return jsonify({"error": "Unknown scheduling algorithm."}), 400

    timeline = merge_timeline(timeline)

    return jsonify({
        "algorithm": algorithm,
        "quantum": quantum if algorithm == "RR" else None,
        "results": results,
        "timeline": timeline,
        "metrics": metrics(results, timeline)
    })


@app.post("/api/compare")
def compare():
    data = request.get_json()
    processes = data.get("processes", [])
    quantum = int(data.get("quantum", 2))

    if not processes:
        return jsonify({"error": "Add at least one process."}), 400

    normalized = []
    for i, p in enumerate(processes):
        normalized.append({
            "id": str(p.get("id") or f"P{i + 1}"),
            "arrival": max(0, int(p["arrival"])),
            "burst": int(p["burst"])
        })

    outputs = {}
    for name, fn in [("FCFS", fcfs), ("SJN", sjn)]:
        results, timeline = fn(normalized)
        timeline = merge_timeline(timeline)
        outputs[name] = metrics(results, timeline)

    results, timeline = round_robin(normalized, quantum)
    timeline = merge_timeline(timeline)
    outputs["RR"] = metrics(results, timeline)

    return jsonify(outputs)


if __name__ == "__main__":
    app.run(debug=True)

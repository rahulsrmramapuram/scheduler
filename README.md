# Process Scheduler Simulation

A full-stack Operating Systems mini-project for simulating:

- First-Come-First-Served (FCFS)
- Shortest Job Next (SJN / non-preemptive SJF)
- Round Robin (RR)

## Technology

Frontend:
- HTML5
- CSS3
- JavaScript
- Chart.js

Backend:
- Python
- Flask
- REST API

## Features

- Add/remove processes dynamically
- Arrival time and burst time
- FCFS scheduling
- SJN scheduling
- Round Robin with configurable time quantum
- Gantt chart
- Completion time
- Turnaround time
- Waiting time
- Response time
- CPU utilization
- Context-switch count
- Algorithm comparison dashboard
- Responsive UI

## Installation

Open a terminal in this folder.

### 1. Create virtual environment

Windows:

```bash
python -m venv venv
venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Run

```bash
python app.py
```

### 4. Open

http://127.0.0.1:5000

## Project Structure

process_scheduler_project/
├── app.py
├── requirements.txt
├── README.md
├── templates/
│   └── index.html
└── static/
    ├── style.css
    └── script.js

## API

POST /api/simulate

Example:

```json
{
  "algorithm": "RR",
  "quantum": 2,
  "processes": [
    {"id": "P1", "arrival": 0, "burst": 5},
    {"id": "P2", "arrival": 1, "burst": 3}
  ]
}
```

POST /api/compare

Returns metrics for FCFS, SJN and RR using the same process set.

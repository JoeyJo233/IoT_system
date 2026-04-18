# Web UI Design

## Goal

Add a browser-based control and observability UI to turn the current project from a backend data pipeline demo into an interactive IoT simulation platform.

The UI should support three major use cases:

1. Configure the simulation dynamically
2. Control the simulation lifecycle
3. Visualize both system flow and sensor data in real time

---

## Product Positioning

Suggested positioning for the project after adding the UI:

**IoT Simulation and Observability Platform**

Compared with the current Producer -> Kafka -> Consumer demo, the Web UI would make the project easier to demo, easier to understand, and more complete as a portfolio project.

---

## Target Features

### 1. Simulation Control

The UI should provide a control plane for managing simulated IoT nodes.

Core capabilities:

- Select sensor types such as temperature, humidity, pressure, and vibration
- Adjust the number of nodes per sensor type
- Configure intervals, value ranges, and optional location tags
- Start the simulation
- Pause or resume the simulation
- Stop and reset the simulation state

Recommended MVP scope:

- Global start / pause / stop
- Per-type node count configuration
- Preset sensor types only

Later enhancements:

- Per-node enable / disable
- Custom sensor type creation
- Scenario presets such as "factory", "warehouse", or "stress test"

### 2. System Flow Visualization

The UI should show how data moves across the system:

`IoT Nodes -> Producer -> Kafka -> Consumer -> Redis / MongoDB`

Recommended display style:

- Topology graph or pipeline cards
- Live counters for produced, buffered, consumed, cached, and persisted messages
- Status indicators for each subsystem
- Error and DLT counters
- Consumer lag and processing rate if available

Important note:

Do not try to animate every single message end-to-end in the first version. A stage-level visualization with rates, counters, and state is much easier to build and much more robust.

### 3. Sensor Data Visualization

The UI should expose business-level sensor insights.

Recommended charts:

- Latest sensor reading cards
- Real-time line charts per sensor type
- Historical line chart for a selected sensor
- Aggregation by sensor type
- Abnormal value highlighting

Nice-to-have additions:

- Threshold-based alerts
- Heatmap by location
- Event timeline for anomalies

---

## Proposed Pages

### 1. Dashboard

Purpose:

- High-level system overview

Widgets:

- System status cards
- Throughput summary
- Kafka lag / DLT summary
- Latest sensor metrics
- Quick actions for start / pause / stop

### 2. Simulation Control

Purpose:

- Configure and control running simulations

Widgets:

- Sensor type configuration table
- Node count controls
- Interval and range settings
- Scenario preset selector
- Start / pause / stop actions

### 3. Data Flow View

Purpose:

- Visualize the pipeline and message movement

Widgets:

- Pipeline diagram
- Rate and count cards for Producer, Kafka, Consumer, Redis, MongoDB
- Error path / DLT section

### 4. Sensor Analytics

Purpose:

- Inspect actual simulated business data

Widgets:

- Type filter
- Sensor filter
- Time-range selector
- Live chart
- History chart
- Recent event table

---

## Recommended Frontend Tech Stack

### Recommended choice

- **Framework:** React
- **Build tool:** Vite
- **Language:** TypeScript
- **UI library:** Ant Design
- **Styling:** Tailwind CSS or Ant Design tokens only
- **Charts:** Apache ECharts
- **State management:** Zustand
- **Data fetching:** TanStack Query
- **Routing:** React Router
- **Realtime channel:** WebSocket first, SSE as fallback if needed

### Why this stack

#### React + TypeScript

- Large ecosystem
- Easy to demo and maintain
- Strong fit for dashboard-style UIs
- Better long-term maintainability than plain HTML + JS

#### Vite

- Fast local development
- Simple setup
- Good default for a standalone frontend app

#### Ant Design

- Strong dashboard/admin-style component library
- Tables, forms, cards, layout, and status components are ready-made
- Helps the UI look polished quickly

#### ECharts

- Good for real-time charts and dashboards
- Flexible enough for both sensor plots and system metrics

#### Zustand + TanStack Query

- Lightweight state handling
- Clear separation between local UI state and server data
- Easier than introducing Redux for this project size

### Alternative stack

If you prefer a more minimal and custom visual style:

- React + TypeScript + Vite
- Tailwind CSS
- shadcn/ui
- Recharts or ECharts

This would look more modern, but it usually takes more UI work than Ant Design.

---

## Recommended Frontend Architecture

Suggested new top-level module:

```text
frontend/
  src/
    app/
    components/
    features/
      dashboard/
      simulation/
      flow/
      analytics/
    services/
    hooks/
    types/
    pages/
```

Suggested feature split:

- `dashboard`: overview metrics and health cards
- `simulation`: config forms and control actions
- `flow`: topology and message-flow visualization
- `analytics`: charts and historical exploration

---

## Backend Capabilities the UI Will Need

The current backend is strong on data flow, but a UI of this kind will need more control and telemetry APIs.

Likely backend additions:

### Control APIs

- `GET /api/simulation/config`
- `PUT /api/simulation/config`
- `POST /api/simulation/start`
- `POST /api/simulation/pause`
- `POST /api/simulation/stop`
- `GET /api/simulation/status`

### Metrics APIs

- `GET /api/metrics/system`
- `GET /api/metrics/pipeline`
- `GET /api/metrics/sensors`

### Realtime channel

- `/ws` for live metrics, state changes, and latest readings

The UI should not read Kafka, Redis, or MongoDB directly. It should always go through a backend API or realtime gateway.

---

## Data Model Ideas

### Sensor type config

```json
{
  "type": "TEMPERATURE",
  "count": 2,
  "intervalMs": 10000,
  "minValue": 15,
  "maxValue": 35,
  "locations": ["warehouse-A", "warehouse-B"],
  "enabled": true
}
```

### Simulation status

```json
{
  "running": true,
  "startedAt": "2026-04-18T18:00:00Z",
  "activeNodeCount": 8,
  "messageRatePerSecond": 12.5
}
```

### Pipeline metrics

```json
{
  "producerRate": 12.5,
  "consumerRate": 12.3,
  "redisWriteRate": 12.3,
  "mongoWriteRate": 12.3,
  "consumerLag": 0,
  "dltCount": 0
}
```

---

## UX Notes

- Prioritize clarity over animation
- Make system state obvious at a glance
- Keep the first version focused on desktop layout
- Use color consistently:
  - green = healthy / running
  - yellow = paused / warning
  - red = error / DLT / unhealthy
- Avoid overloading the first screen with too many charts

---

## Implementation Strategy

### Phase 1: MVP

Goal:

- Deliver a usable UI that can control the simulation and show key metrics

Scope:

1. Create standalone `frontend/` app
2. Add dashboard layout
3. Add simulation control page
4. Add system flow page
5. Add basic sensor charts
6. Add backend APIs for simulation control and status
7. Add one realtime channel for live updates

### Phase 2: Enhanced observability

Goal:

- Make the project feel like a real monitoring console

Scope:

1. Add DLT and error visualizations
2. Add Kafka lag and throughput history
3. Add historical sensor exploration
4. Add scenario presets
5. Add richer alerting and anomaly highlights

### Phase 3: Advanced simulation

Goal:

- Make the simulator configurable at runtime

Scope:

1. Add per-node controls
2. Add custom sensor-type templates
3. Add import/export of simulation scenarios
4. Add multi-session or saved runs if needed

---

## TODO List

### Planning

- [ ] Confirm whether the frontend should live in a new `frontend/` directory or inside an existing service
- [ ] Confirm whether backend control APIs belong in `producer-service`, `consumer-service`, or a new gateway service
- [ ] Decide whether realtime updates use WebSocket or SSE for MVP

### Frontend foundation

- [ ] Create frontend project with React + Vite + TypeScript
- [ ] Add linting, formatting, and environment config
- [ ] Set up routing, layout, and shared UI theme
- [ ] Define shared API types

### Simulation control

- [ ] Design simulation config form
- [ ] Add global start / pause / stop controls
- [ ] Add per-sensor-type count and interval editing
- [ ] Show current simulation status

### Flow visualization

- [ ] Design the pipeline view
- [ ] Add subsystem status cards
- [ ] Add throughput counters
- [ ] Add Kafka lag and DLT indicators

### Analytics

- [ ] Add latest value cards
- [ ] Add live time-series charts
- [ ] Add sensor type and sensor ID filters
- [ ] Add historical query view

### Backend support

- [ ] Add simulation config API
- [ ] Add simulation control API
- [ ] Add simulation status API
- [ ] Add system metrics API
- [ ] Add realtime push endpoint

### DevOps and integration

- [ ] Add frontend container or dev startup instructions
- [ ] Integrate frontend into Docker Compose
- [ ] Decide whether CI should also build the frontend
- [ ] Update README with UI usage instructions after implementation

---

## Recommendation Summary

Recommended first implementation path:

1. Create a standalone `frontend/` app
2. Use React + TypeScript + Vite
3. Use Ant Design + ECharts
4. Keep the first version focused on:
   - simulation control
   - pipeline visibility
   - live sensor charts
5. Add backend control and metrics APIs before attempting complex visual effects

This path gives the best balance between implementation speed, demo value, and long-term maintainability.

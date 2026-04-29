# Intagg
Internships Aggregator
# Intagg — Internships, Unified

Intagg is a high-performance, unified aggregator platform designed to classify and serve over 15,000 active data points, including internships, fellowships, and hackathons. 

The platform utilizes a modern split architecture, separating a lightning-fast global CDN frontend from a robust Python cloud API, ensuring zero-latency browsing for users.

## 🚀 Live Demo
* **Frontend UI:** [Insert Your Vercel URL Here]
* **Backend API:** [Insert Your Render API URL Here]

## 🏗️ Architecture

This project is divided into two distinct environments to optimize for both speed and data-processing capabilities:

### Frontend
* **Stack:** Vanilla JavaScript, HTML5, CSS3
* **Hosting:** Vercel (Global Edge CDN)
* **Features:** Dynamic DOM manipulation, asynchronous REST API fetching, secure authentication flows, and an admin dashboard.

### Backend
* **Stack:** Python 3, Flask, psycopg2
* **Hosting:** Render (Web Service)
* **Database:** PostgreSQL (Cloud)
* **Features:** Lightweight JSON API endpoints, Cross-Origin Resource Sharing (CORS) security, and an automated UptimeRobot integration to prevent server sleep cycles.

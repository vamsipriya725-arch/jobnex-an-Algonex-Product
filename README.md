# 🚀 Jobnex – Resume & Job Description Analyzer

<p align="center">
  <b>Smart Resume Matcher & Skill Gap Analyzer built with FastAPI, MySQL, and Modern Web Technologies.</b>
</p>

<p align="center">
  <a href="https://github.com/BhavaniKandula/Jobnex">
    <img src="https://img.shields.io/badge/Version-1.0.0-blue.svg" alt="Version 1.0.0">
  </a>
  <a href="https://fastapi.tiangolo.com">
    <img src="https://img.shields.io/badge/Backend-FastAPI-009688.svg" alt="FastAPI">
  </a>
  <a href="https://www.python.org">
    <img src="https://img.shields.io/badge/Python-3.10%2B-3776AB.svg" alt="Python">
  </a>
  <a href="https://www.mysql.com">
    <img src="https://img.shields.io/badge/Database-MySQL-4479A1.svg" alt="MySQL">
  </a>
</p>

---

## 📖 Overview

**Jobnex** is an intelligent web application designed to help job seekers and recruiters evaluate resume fit against specific job descriptions. By parsing key technical skills and matching them in real time, Jobnex computes a compatibility score, flags missing competencies, and offers tailored suggestions to optimize resumes for target roles.

---

## ✨ Key Features

- **🎯 Skill Matching**: Compares candidate resumes with target job descriptions across in-demand skills (Python, SQL, React, FastAPI, Docker, and more).
- **📊 Match Scoring**: Calculates an instant match percentage indicating candidate suitability.
- **💡 Smart Recommendations**: Generates actionable feedback and suggestions to bridge skill gaps.
- **💾 Persistent History**: Automatically logs analyses into a MySQL database for historical tracking and review.
- **⚡ High Performance REST API**: Built on **FastAPI** with CORS middleware, structured error handling, and asynchronous support.
- **🖥️ Responsive Interface**: Simple and intuitive web client built with HTML5, modern CSS3, and JavaScript.

---

## 🛠️ Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Backend** | Python, FastAPI, Uvicorn, Pydantic |
| **Database** | MySQL, `mysql-connector-python` |
| **Frontend** | HTML5, CSS3, JavaScript (Fetch API) |
| **Version Control** | Git & GitHub |

---

## 📂 Project Structure

```text
Jobnex/
├── .gitignore               # Ignored files (virtual environments, caches, envs)
├── README.md                # Project documentation
├── backend/
│   ├── analyzer.py          # Resume parsing, skill extraction & scoring logic
│   ├── database.py          # MySQL database connection handler
│   ├── insert_test.py       # DB insert verification script
│   ├── main.py              # FastAPI server endpoints (/api/analyze, /api/analyses)
│   ├── requirements.txt     # Python dependencies
│   ├── test_analyzer.py     # Analyzer test script
│   └── test_db.py           # Database connectivity test script
└── Frontend/
    ├── index.html           # Main user interface
    ├── script.js            # Frontend logic & API communication
    └── style.css            # Stylesheet & layout design
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Python 3.10+** installed
- **MySQL Server** installed and running
- **Git**

---

### 2. Clone the Repository
```bash
git clone https://github.com/BhavaniKandula/Jobnex.git
cd Jobnex
```

---

### 3. Database Setup
Log into your MySQL shell and create the database and table:

```sql
CREATE DATABASE IF NOT EXISTS jobnex;

USE jobnex;

CREATE TABLE IF NOT EXISTS resume_analyzer (
    Analysis_id INT AUTO_INCREMENT PRIMARY KEY,
    resume_text TEXT NOT NULL,
    jd_text TEXT NOT NULL,
    matched_skills JSON,
    missing_skills JSON,
    matched_score DECIMAL(5, 2),
    suggestions JSON,
    created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

> **Note**: Verify or update your MySQL credentials in [`backend/database.py`](backend/database.py).

---

### 4. Backend Setup & Run

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. (Optional) Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. Install required packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the FastAPI development server:
   ```bash
   uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```

The backend will be running at `http://127.0.0.1:8000`. You can also explore interactive API documentation at `http://127.0.0.1:8000/docs`.

---

### 5. Running the Frontend

1. Open `Frontend/index.html` in your web browser (or use VS Code **Live Server** on port 5500/5501).
2. Paste the resume text and job description into the input fields.
3. Click **"Analyze resume"** to receive the match score and recommendations in real time!

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Health check endpoint |
| `POST` | `/api/analyze` | Analyzes resume against job description & saves results |
| `GET` | `/api/analyses` | Retrieves recent analysis history |

---

## 🔐 Google OAuth & Supabase Authentication Configuration Checklist

JobNex uses Google OAuth provisioned through **Supabase Auth**. No Google client secrets or Google SDK scripts reside in the frontend code.

### 1. Google Cloud Console Setup
1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **APIs & Services → OAuth consent screen**:
   - User Type: **External**
   - App Name: `JobNex`
   - Scopes: `email`, `profile`, `openid`
3. Navigate to **Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: `JobNex Supabase Web Client`
   - **Authorized JavaScript origins**:
     - `http://localhost:5173`
     - `http://localhost:3000`
     - `https://<your-production-domain>`
   - **Authorized redirect URIs**:
     - `https://swqebafkntjlgjglylcr.supabase.co/auth/v1/callback` (format: `https://<project-ref>.supabase.co/auth/v1/callback`)
4. Copy the generated **Client ID** and **Client Secret**.

---

### 2. Supabase Dashboard Setup
1. Open your project at [Supabase Dashboard](https://supabase.com/dashboard/project/swqebafkntjlgjglylcr).
2. Go to **Authentication → Providers → Google**:
   - Toggle **Enable Google provider** to **ON**.
   - Paste **Client ID** from Google Cloud Console.
   - Paste **Client Secret** from Google Cloud Console.
   - Click **Save**.
3. Go to **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:5173` (or your production URL).
   - **Redirect URLs** (add all environments):
     - `http://localhost:5173/**`
     - `http://localhost:3000/**`
     - `http://localhost:8000/**`
     - `https://<your-production-domain>/**`
   - Click **Save**.

---

### 3. Database Trigger (`profiles` creation)
Run the following SQL in your Supabase SQL Editor (also in `supabase_schema.sql`):
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, phone, role, avatar_url)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
        new.email,
        COALESCE(new.raw_user_meta_data->>'phone', ''),
        COALESCE(new.raw_user_meta_data->>'role', 'seeker'),
        COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', '')
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        avatar_url = EXCLUDED.avatar_url;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

### 4. Frontend Environment Variables
In `Frontend/.env.local`:
```env
VITE_SUPABASE_URL=https://swqebafkntjlgjglylcr.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_ax9iQjGlK5pP34biLoMcag_0egUp2qE
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to check out the [issues page](https://github.com/BhavaniKandula/Jobnex/issues).

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

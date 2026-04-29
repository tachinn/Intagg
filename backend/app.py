from flask import Flask, jsonify, send_from_directory, request, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import datetime
from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))

# Tell Flask where your frontend files live
app = Flask(__name__, static_folder='../frontend')
app.secret_key = os.getenv("SECRET_KEY", "super-secret-dev-key")
CORS(app) 

def get_db_connection():
    return psycopg2.connect(os.getenv("DATABASE_URL"))

def record_activity(metric_col, increment_by=1):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        today = datetime.date.today()
        day_name = today.strftime("%A")
        query = f"""
            INSERT INTO daily_activity (activity_date, day_name, {metric_col})
            VALUES (%s, %s, %s)
            ON CONFLICT (activity_date) DO UPDATE
            SET {metric_col} = daily_activity.{metric_col} + EXCLUDED.{metric_col}, last_updated = CURRENT_TIMESTAMP
        """
        cur.execute(query, (today, day_name, increment_by))
        conn.commit()
    except Exception as e:
        print(f"Failed to record activity {metric_col}: {e}")
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()

# --- FRONTEND ROUTES ---

# 1. Serve the main HTML file when they go to the root URL
@app.route('/')
def serve_index():
    # If your main page is internships.html, change this line to match!
    return send_from_directory(app.static_folder, 'index.html')

# 2. Catch-all route to serve your CSS, JS, and Images
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

# --- BACKEND API ROUTES ---

@app.route('/api/internships', methods=['GET'])
def get_internships():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        query = "SELECT title, company_name, location, stipend_amount, duration, source_url, source_platform, category FROM internships WHERE is_active = TRUE"
        count_query = "SELECT COUNT(*) FROM internships WHERE is_active = TRUE"
        params = []
        
        # Filtering
        profile_str = request.args.get('profile')
        if profile_str:
            profiles = profile_str.split(',')
            query += " AND category = ANY(%s)"
            count_query += " AND category = ANY(%s)"
            params.append(profiles)
            
        location_str = request.args.get('location')
        if location_str:
            locations = location_str.split(',')
            query += " AND location = ANY(%s)"
            count_query += " AND location = ANY(%s)"
            params.append(locations)
            
        stipend = request.args.get('stipend', type=int)
        if stipend:
            query += " AND stipend_amount >= %s"
            count_query += " AND stipend_amount >= %s"
            params.append(stipend)
            
        # Sorting
        sort = request.args.get('sort')
        if sort == 'stipend_asc':
            query += " ORDER BY stipend_amount ASC"
        elif sort == 'stipend_desc':
            query += " ORDER BY stipend_amount DESC"
        else:
            query += " ORDER BY last_seen_at DESC"
            
        # Pagination
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        offset = (page - 1) * limit
        
        cur.execute(count_query, tuple(params))
        total = cur.fetchone()['count']
        
        query += " LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        cur.execute(query, tuple(params))
        jobs = cur.fetchall()
        
        return jsonify({
            "jobs": jobs,
            "total": total,
            "page": page,
            "limit": limit
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()

@app.route('/api/feedback', methods=['POST'])
def submit_feedback():
    data = request.json
    email = data.get('email')
    message = data.get('message')
    if not message or not email:
        return jsonify({"error": "Email and message are required"}), 400
        
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("INSERT INTO user_feedback (email, message) VALUES (%s, %s)", (email, message))
        conn.commit()
        return jsonify({"success": True, "message": "Feedback submitted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()

@app.route('/api/feedback', methods=['GET'])
def get_feedback():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id, email, message, created_at FROM user_feedback ORDER BY created_at DESC")
        feedback = cur.fetchall()
        return jsonify({"feedback": feedback})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()

# --- AUTH ROUTES ---

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    full_name = data.get('full_name')
    email = data.get('email')
    password = data.get('password')
    college_or_org = data.get('college_or_org', '')
    
    if not full_name or not email or not password:
        return jsonify({"error": "Missing required fields"}), 400
        
    hashed_password = generate_password_hash(password)
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check if email exists
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cur.fetchone():
            return jsonify({"error": "Email already registered"}), 400
            
        cur.execute(
            "INSERT INTO users (full_name, email, password, college_or_org) VALUES (%s, %s, %s, %s) RETURNING id",
            (full_name, email, hashed_password, college_or_org)
        )
        user_id = cur.fetchone()[0]
        conn.commit()
        
        # Log them in automatically
        session['user_id'] = user_id
        session['user_name'] = full_name
        
        record_activity('new_users')
        record_activity('dau')
        
        return jsonify({"success": True, "message": "Signup successful"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
        
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id, full_name, password FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        
        if user and check_password_hash(user['password'], password):
            session['user_id'] = user['id']
            session['user_name'] = user['full_name']
            
            today_str = str(datetime.date.today())
            session['last_dau_date'] = today_str
            record_activity('dau')
            
            return jsonify({"success": True, "message": "Login successful"})
        else:
            return jsonify({"error": "Invalid email or password"}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"success": True, "message": "Logged out"})

@app.route('/api/me', methods=['GET'])
def get_current_user():
    user_id = session.get('user_id')
    user_name = session.get('user_name')
    if user_id:
        today_str = str(datetime.date.today())
        if session.get('last_dau_date') != today_str:
            record_activity('dau')
            session['last_dau_date'] = today_str
        return jsonify({"logged_in": True, "user_id": user_id, "name": user_name})
    return jsonify({"logged_in": False})

@app.route('/api/bookmarks', methods=['GET', 'POST'])
def manage_bookmarks():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
        
    try:
        conn = get_db_connection()
        if request.method == 'GET':
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("""
                SELECT i.title, i.company_name, i.location, i.stipend_amount, 
                       i.duration, i.source_url, i.source_platform, i.category 
                FROM user_bookmarks b
                JOIN internships i ON b.job_url = i.source_url
                WHERE b.user_id = %s
            """, (user_id,))
            bookmarks = cur.fetchall()
            return jsonify({"bookmarks": bookmarks})
            
        elif request.method == 'POST':
            cur = conn.cursor()
            data = request.json
            action = data.get('action') # 'add' or 'remove'
            job_url = data.get('job_url')
            
            if not job_url or action not in ['add', 'remove']:
                return jsonify({"error": "Invalid request"}), 400
                
            if action == 'add':
                cur.execute(
                    "INSERT INTO user_bookmarks (user_id, job_url) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (user_id, job_url)
                )
            elif action == 'remove':
                cur.execute(
                    "DELETE FROM user_bookmarks WHERE user_id = %s AND job_url = %s",
                    (user_id, job_url)
                )
            conn.commit()
            return jsonify({"success": True})
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()

# --- TRACKING ROUTES ---

@app.route('/api/track/visit', methods=['POST'])
def track_visit():
    record_activity('total_visitors')
    return jsonify({"success": True})

@app.route('/api/track/apply', methods=['POST'])
def track_apply():
    record_activity('total_apply')
    user_id = session.get('user_id')
    if user_id:
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("UPDATE users SET total_apply = total_apply + 1 WHERE id = %s", (user_id,))
            conn.commit()
        except Exception as e:
            print("Error updating user total_apply:", e)
        finally:
            if 'cur' in locals(): cur.close()
            if 'conn' in locals(): conn.close()
    return jsonify({"success": True})

@app.route('/api/track/session', methods=['POST'])
def track_session():
    data = request.json or {}
    duration = data.get('duration', 0)
    try:
        duration = int(duration)
        if duration > 0:
            record_activity('total_session_time', duration)
            record_activity('total_sessions', 1)
    except:
        pass
    return jsonify({"success": True})

@app.route('/api/admin/stats', methods=['GET'])
def admin_stats():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM daily_activity ORDER BY activity_date DESC LIMIT 30")
        stats = cur.fetchall()
        for s in stats:
            s['conversion_rate'] = round(s['new_users'] / s['total_visitors'], 4) if s.get('total_visitors') else 0
            s['avg_session_seconds'] = round(s['total_session_time'] / s['total_sessions'], 1) if s.get('total_sessions') else 0
            # format date
            s['activity_date'] = str(s['activity_date'])
            if 'last_updated' in s and s['last_updated']:
                s['last_updated'] = str(s['last_updated'])
        return jsonify({"stats": stats})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
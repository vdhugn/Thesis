from flask import Flask, jsonify, render_template
from flask_cors import CORS
import psycopg2

app = Flask(__name__)
CORS(app)  # Allow frontend JS to call this backend

@app.route('/index.html')
def index():
    return render_template('index.html')

@app.route('/search_result.html')
def search_result():
    return render_template('search_result.html')

@app.route('/station.html')
def station():
    return render_template('station.html')

@app.route('/map.html')
def map():
    return render_template('map.html')

@app.route('/dashboard.html')
def dashboard():
    return render_template('dashboard.html')

# PostgreSQL connection
def get_db_connection():
    return psycopg2.connect(
        host="localhost",
        database="AQIDB",
        user="postgres",
        password="password"
    )


@app.route('/api/stations', methods=['GET'])
def get_stations():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            uid, aqi, station_name, lat, lon, datetime,
            pm25, pm10, co, no2, o3, so2,
            temperature, humidity, pressure, wind
        FROM visual
    """)
    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    # Convert to GeoJSON
    features = []
    for row in rows:
        (uid, aqi, name, lat, lon, time,
         pm25, pm10, co, no2, o3, so2,
         temperature, humidity, pressure, wind) = row

        aqi_value = aqi if aqi not in (None, '-') else None

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat]
            },
            "properties": {
                "uid": uid,
                "aqi": aqi_value,
                "name": name,
                "time": time,
                "pm25": pm25,
                "pm10": pm10,
                "co": co,
                "no2": no2,
                "o3": o3,
                "so2": so2,
                "temperature": temperature,
                "humidity": humidity,
                "pressure": pressure,
                "wind": wind
            }
        })

    geojson = {
        "type": "FeatureCollection",
        "features": features
    }

    return jsonify(geojson)

@app.route('/api/station_detail/<int:uid>', methods=['GET'])
def station_detail(uid):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get latest station snapshot
    cursor.execute("""
        SELECT v.station_name, v.aqi, v.datetime, v.lat, v.lon,
            v.temperature, v.humidity, v.pressure,
            f.date, f.pm25_avg
        FROM visual v
        LEFT JOIN forecast f ON v.uid = f.uid
        WHERE v.uid = %s
        ORDER BY f.date
    """, (uid,))
    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    if not rows:
        return jsonify({"error": "Station not found"}), 404

    # Unpack the first row for station metadata
    name, aqi, stime, lat, lon, temp, hum, press, _, _ = rows[0]

    # Collect all forecasts
    forecasts = []
    for row in rows:
        f_date = row[8]
        f_pm25 = row[9]
        if f_date is not None and f_pm25 is not None:
            forecasts.append({
                "date": f_date,
                "avg_pm25": f_pm25
            })

    # Final response
    return jsonify({
        "uid": uid,
        "name": name,
        "aqi": aqi,
        "last_update": stime,
        "latitude": lat,
        "longitude": lon,
        "temperature": temp,
        "humidity": hum,
        "pressure": press,
        "forecast": forecasts
    })


@app.route("/api/province_aqi")
def province_aqi():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT province, aqi, pm25, pm10, co, no2 FROM province")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify([{"province": r[0], 
                         "aqi": r[1],
                         "pm25": r[2],
                         "pm10": r[3],
                         "co": r[4],
                         "no2": r[5]} for r in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/station_history/<uid>")
def get_station_history(uid):
    conn = get_db_connection()
    cur = conn.cursor()
    
    # 12 months
    cur.execute("""
        SELECT * FROM (
            SELECT
                day,
                ROUND(AVG(aqi)) AS avg_aqi
            FROM (
                SELECT
                    DATE(datetime) AS day,
                    aqi
                FROM
                    historical
                WHERE
                    uid = %s
            ) sub
            GROUP BY
                day
            ORDER BY
                day DESC
            LIMIT 30
        ) recent_days
        ORDER BY day ASC;
    """, (uid,))
    daily = cur.fetchall()

    # 24 recent hours
    cur.execute("""
        SELECT TO_CHAR(datetime::timestamp, 'MM-DD HH24:00') AS month, aqi
        FROM historical
        WHERE uid = %s
        ORDER BY datetime DESC
        LIMIT 24
    """, (uid,))
    recent = cur.fetchall()
    
    cur.close()
    conn.close()

    return jsonify({
        "daily": [{"time": str(d[0]), "aqi": round(d[1], 1)} for d in daily],
        "recent": [{"time": str(r[0]), "aqi": r[1]} for r in reversed(recent)]  # reverse for chronological order
    })


if __name__ == '__main__':
    app.run(debug=True)

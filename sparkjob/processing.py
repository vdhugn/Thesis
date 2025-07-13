from pyspark.sql import SparkSession, Row
from pyspark.sql.functions import col, when, radians, sin, cos, sqrt, atan2, row_number, greatest, from_unixtime, to_timestamp, explode
from pyspark.sql.types import IntegerType
from pyspark.sql.window import Window

# Start Spark session
spark = SparkSession.builder \
    .appName("Write AQI JSON from MinIO to Postgres") \
    .config("spark.hadoop.fs.s3a.endpoint", "http://172.18.0.2:9000") \
    .config("spark.hadoop.fs.s3a.access.key", "admin") \
    .config("spark.hadoop.fs.s3a.secret.key", "password") \
    .config("spark.hadoop.fs.s3a.path.style.access", "true") \
    .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem") \
    .getOrCreate()

jdbc_url = "jdbc:postgresql://minio-iceberg-trino:5432/AQIDB"

# PROVINCE TABLE

province_names = [
    "Ha Noi", "TP. Ho Chi Minh", "Hai Phong", "Da Nang", "Can Tho", "Hue", "Vinh Phuc", "Bac Ninh",
    "Quang Ninh", "Hai Duong", "Hung Yen", "Thai Binh", "Ha Nam", "Nam Dinh", "Ninh Binh", "Ha Giang", "Cao Bang",
    "Bac Kan", "Tuyen Quang", "Lao Cai", "Yen Bai", "Thai Nguyen", "Lang Son", "Bac Giang", "Phu Tho", "Dien Bien",
    "Lai Chau", "Son La", "Hoa Binh", "Thanh Hoa", "Nghe An", "Ha Tinh", "Quang Binh", "Quang Tri", "Quang Nam",
    "Quang Ngai", "Binh Dinh", "Phu Yen", "Khanh Hoa", "Ninh Thuan", "Binh Thuan", "Kon Tum", "Gia Lai", "Dak Lak",
    "Dak Nong", "Lam Dong", "Binh Phuoc", "Tay Ninh", "Binh Duong", "Dong Nai", "Ba Ria - Vung Tau", "Long An",
    "Tien Giang", "Ben Tre", "Tra Vinh", "Vinh Long", "Dong Thap", "An Giang", "Kien Giang", "Hau Giang", "Soc Trang",
    "Bac Lieu", "Ca Mau"
]

province_df = spark.createDataFrame([(p,) for p in province_names], ["province"])
df = spark.read.json("s3a://province-data/provinces.json")

df = df.select(
    col("coord.lat").alias("lat"),
    col("coord.lon").alias("lon"),
    col("list")[0]["components"]["pm2_5"].alias("pm25"),
    col("list")[0]["components"]["pm10"].alias("pm10"),
    col("list")[0]["components"]["co"].alias("co"),
    col("list")[0]["components"]["no2"].alias("no2"),
    col("list")[0]["components"]["o3"].alias("o3"),
    col("list")[0]["components"]["so2"].alias("so2")
)

df = df.withColumn("co", col("co") * 24.45 / (28.01 * 1000))
df = df.withColumn("no2", col("no2") * 24.45 / 46.01)
df = df.withColumn("so2", col("so2") * 24.45 / 64.07)
df = df.withColumn("o3", col("o3") * 24.45 / 48.00)

def aqi_pm25(c): return (
    when((c >= 0) & (c <= 12.0),   ((c - 0)    * (50 - 0)    / (12.0 - 0)    + 0))  .
    when((c > 12.0) & (c <= 35.4), ((c - 12.1) * (100 - 51)  / (35.4 - 12.1) + 51)) .
    when((c > 35.4) & (c <= 55.4), ((c - 35.5) * (150 - 101) / (55.4 - 35.5) + 101)).
    when((c > 55.4) & (c <= 150.4),((c - 55.5) * (200 - 151) / (150.4 - 55.5)+ 151)).
    when((c > 150.4) & (c <= 250.4),((c - 150.5)*(300 - 201)/(250.4 - 150.5)+ 201)).
    when((c > 250.4) & (c <= 350.4),((c - 250.5)*(400 - 301)/(350.4 - 250.5)+ 301)).
    when((c > 350.4) & (c <= 500.4),((c - 350.5)*(500 - 401)/(500.4 - 350.5)+ 401))
)

def aqi_pm10(c): return (
    when((c >= 0) & (c <= 54),     ((c - 0)    * (50 - 0)    / (54 - 0)      + 0))  .
    when((c > 54) & (c <= 154),    ((c - 55)   * (100 - 51)  / (154 - 55)    + 51)) .
    when((c > 154) & (c <= 254),   ((c - 155)  * (150 - 101) / (254 - 155)   + 101)).
    when((c > 254) & (c <= 354),   ((c - 255)  * (200 - 151) / (354 - 255)   + 151)).
    when((c > 354) & (c <= 424),   ((c - 355)  * (300 - 201) / (424 - 355)   + 201)).
    when((c > 424) & (c <= 504),   ((c - 425)  * (400 - 301) / (504 - 425)   + 301)).
    when((c > 504) & (c <= 604),   ((c - 505)  * (500 - 401) / (604 - 505)   + 401))
)

def aqi_co(c): return (
    when((c >= 0.0) & (c <= 4.4),    ((c - 0.0)   * (50 - 0)   / (4.4 - 0.0)   + 0)).
    when((c > 4.4) & (c <= 9.4),     ((c - 4.5)   * (100 - 51) / (9.4 - 4.5)   + 51)).
    when((c > 9.4) & (c <= 12.4),    ((c - 9.5)   * (150 - 101)/ (12.4 - 9.5)  + 101)).
    when((c > 12.4) & (c <= 15.4),   ((c - 12.5)  * (200 - 151)/ (15.4 - 12.5) + 151)).
    when((c > 15.4) & (c <= 30.4),   ((c - 15.5)  * (300 - 201)/ (30.4 - 15.5) + 201)).
    when((c > 30.4) & (c <= 40.4),   ((c - 30.5)  * (400 - 301)/ (40.4 - 30.5) + 301)).
    when((c > 40.4) & (c <= 50.4),   ((c - 40.5)  * (500 - 401)/ (50.4 - 40.5) + 401))
)

def aqi_no2(c): return (
    when((c >= 0) & (c <= 53),     ((c - 0)    * (50 - 0)    / (53 - 0)     + 0))  .
    when((c > 53) & (c <= 100),    ((c - 54)   * (100 - 51)  / (100 - 54)   + 51)) .
    when((c > 100) & (c <= 360),   ((c - 101)  * (150 - 101) / (360 - 101)  + 101)).
    when((c > 360) & (c <= 649),   ((c - 361)  * (200 - 151) / (649 - 361)  + 151)).
    when((c > 649) & (c <= 1249),  ((c - 650)  * (300 - 201) / (1249 - 650) + 201)).
    when((c > 1249) & (c <= 1649), ((c - 1250) * (400 - 301) / (1649 - 1250)+ 301)).
    when((c > 1649) & (c <= 2049), ((c - 1650) * (500 - 401) / (2049 - 1650)+ 401))
)

def aqi_o3(c): return (
    when((c >= 0) & (c <= 54),     ((c - 0)    * (50 - 0)    / (54 - 0)     + 0))  .
    when((c > 54) & (c <= 70),     ((c - 55)   * (100 - 51)  / (70 - 55)    + 51)) .
    when((c > 70) & (c <= 85),     ((c - 71)   * (150 - 101) / (85 - 71)    + 101)).
    when((c > 85) & (c <= 105),    ((c - 86)   * (200 - 151) / (105 - 86)   + 151)).
    when((c > 105) & (c <= 200),   ((c - 106)  * (300 - 201) / (200 - 106)  + 201))
)

def aqi_so2(c): return (
    when((c >= 0) & (c <= 35),     ((c - 0)    * (50 - 0)    / (35 - 0)     + 0))  .
    when((c > 35) & (c <= 75),     ((c - 36)   * (100 - 51)  / (75 - 36)    + 51)) .
    when((c > 75) & (c <= 185),    ((c - 76)   * (150 - 101) / (185 - 76)   + 101)).
    when((c > 185) & (c <= 304),   ((c - 186)  * (200 - 151) / (304 - 186)  + 151)).
    when((c > 304) & (c <= 604),   ((c - 305)  * (300 - 201) / (604 - 305)  + 201)).
    when((c > 604) & (c <= 804),   ((c - 605)  * (400 - 301) / (804 - 605)  + 301)).
    when((c > 804) & (c <= 1004),  ((c - 805)  * (500 - 401) / (1004 - 805) + 401))
)

df = df.withColumn("aqi_pm25", aqi_pm25(col("pm25")).cast(IntegerType()))
df = df.withColumn("aqi_pm10", aqi_pm10(col("pm10")).cast(IntegerType()))
df = df.withColumn("aqi_co",   aqi_co(col("co")).cast(IntegerType()))
df = df.withColumn("aqi_no2",  aqi_no2(col("no2")).cast(IntegerType()))
df = df.withColumn("aqi_o3",   aqi_o3(col("o3")).cast(IntegerType()))
df = df.withColumn("aqi_so2",  aqi_so2(col("so2")).cast(IntegerType()))

df = df.withColumn("aqi", greatest(
    "aqi_pm25", "aqi_pm10", "aqi_co", "aqi_no2", "aqi_o3", "aqi_so2"
))

df.drop("aqi_pm25", "aqi_pm10", "aqi_co", "aqi_no2", "aqi_o3", "aqi_so2","lat","lon")

df_with_index = df.rdd.zipWithIndex().map(
    lambda row: Row(
        province=province_names[row[1]],
        pm25=row[0]['pm25'],
        pm10=row[0]['pm10'],
        co=row[0]['co'],
        no2=row[0]['no2'],
        o3=row[0]['o3'],
        so2=row[0]['so2'],
        aqi=row[0]['aqi']
    )
)

df1 = df_with_index.toDF()

df1.write \
    .format("jdbc") \
    .option("url", jdbc_url) \
    .option("dbtable", "province_staging") \
    .option("user", "postgres") \
    .option("password", "password") \
    .option("driver", "org.postgresql.Driver") \
    .mode("overwrite") \
    .save()


# VISUAL TABLE

ow_raw = spark.read.json("s3a://aqi-data/openweather.json")
ow = ow_raw.select(
    col("coord.lat").alias("lat"),
    col("coord.lon").alias("lon"),
    col("list")[0]["components"]["pm2_5"].alias("pm25"),
    col("list")[0]["components"]["pm10"].alias("pm10"),
    col("list")[0]["components"]["co"].alias("co"),
    col("list")[0]["components"]["no2"].alias("no2"),
    col("list")[0]["components"]["o3"].alias("o3"),
    col("list")[0]["components"]["so2"].alias("so2"),
    col("list")[0]["dt"].alias("timestamp")
)

ow = ow.withColumn("co", col("co") * 24.45 / (28.01 * 1000))
ow = ow.withColumn("no2", col("no2") * 24.45 / 46.01)
ow = ow.withColumn("so2", col("so2") * 24.45 / 64.07)
ow = ow.withColumn("o3", col("o3") * 24.45 / 48.00)

ow = ow.withColumn("aqi_pm25", aqi_pm25(col("pm25")).cast(IntegerType()))
ow = ow.withColumn("aqi_pm10", aqi_pm10(col("pm10")).cast(IntegerType()))
ow = ow.withColumn("aqi_co",   aqi_co(col("co")).cast(IntegerType()))
ow = ow.withColumn("aqi_no2",  aqi_no2(col("no2")).cast(IntegerType()))
ow = ow.withColumn("aqi_o3",   aqi_o3(col("o3")).cast(IntegerType()))
ow = ow.withColumn("aqi_so2",  aqi_so2(col("so2")).cast(IntegerType()))

ow = ow.withColumn("ow_aqi", greatest(
    "aqi_pm25", "aqi_pm10", "aqi_co", "aqi_no2", "aqi_o3", "aqi_so2"
))

ow.drop("aqi_pm25", "aqi_pm10", "aqi_co", "aqi_no2", "aqi_o3", "aqi_so2")

aqicn_raw = spark.read.json("s3a://aqi-data/aqicn.json")
aqicn = aqicn_raw.selectExpr(
    "data.idx as uid",
    "data.city.name as station_name",
    "data.city.geo[0] as lat",
    "data.city.geo[1] as lon",
    "data.iaqi.h.v as humidity",
    "data.iaqi.t.v as temperature",
    "data.iaqi.w.v as wind",
    "data.iaqi.p.v as pressure",
    "data.aqi as aqicn_aqi"
)

# Add radians
aqicn = aqicn.withColumn("lat_rad", radians(col("lat"))).withColumn("lon_rad", radians(col("lon")))
ow = ow \
    .withColumnRenamed("lat", "ow_lat") \
    .withColumnRenamed("lon", "ow_lon") \
    .withColumn("ow_lat_rad", radians(col("ow_lat"))) \
    .withColumn("ow_lon_rad", radians(col("ow_lon")))

# Cross join and compute Haversine distance
joined = aqicn.crossJoin(ow)
joined = joined.withColumn("distance_km", 6371 * 2 * atan2(
    sqrt(
        sin((col("lat_rad") - col("ow_lat_rad")) / 2) ** 2 +
        cos(col("lat_rad")) * cos(col("ow_lat_rad")) *
        sin((col("lon_rad") - col("ow_lon_rad")) / 2) ** 2
    ),
    sqrt(
        1 - (
            sin((col("lat_rad") - col("ow_lat_rad")) / 2) ** 2 +
            cos(col("lat_rad")) * cos(col("ow_lat_rad")) *
            sin((col("lon_rad") - col("ow_lon_rad")) / 2) ** 2
        )
    )
))

# Create a window partitioned by UID, ordered by distance
window_spec = Window.partitionBy("uid").orderBy(col("distance_km").asc())

# Assign row numbers based on distance within each UID group
ranked = joined.withColumn("row_num", row_number().over(window_spec))

# Keep only the closest match (row_num == 1)
filtered = ranked.filter(col("row_num") == 1).drop("row_num")

filtered = filtered.withColumn("aqi",
    when((col("aqicn_aqi").isNotNull()) & (col("aqicn_aqi") != "-"), col("aqicn_aqi").cast("int"))
    .otherwise(col("ow_aqi"))
)

filtered = filtered.withColumn("datetime", to_timestamp(from_unixtime("timestamp")))

# Select final columns
df2 = filtered.select(
    "uid", "station_name", "lat", "lon",
    "humidity", "temperature", "wind", "pressure", "datetime",
    "co", "no2", "o3", "so2", "pm25", "pm10", "aqi"
)

df2.write \
    .format("jdbc") \
    .option("url", jdbc_url) \
    .option("dbtable", "visual_staging") \
    .option("user", "postgres") \
    .option("password", "password") \
    .option("driver", "org.postgresql.Driver") \
    .mode("overwrite") \
    .save()


# FORECAST TABLE

df3 = aqicn_raw.select(
    col("data.idx").alias("uid"),
    explode("data.forecast.daily.pm25").alias("pm25_forecast")
).select(
    col("uid"),
    col("pm25_forecast.day").alias("date"),
    col("pm25_forecast.avg").alias("pm25_avg")
)

df3.write \
    .format("jdbc") \
    .option("url", jdbc_url) \
    .option("dbtable", "forecast_staging") \
    .option("user", "postgres") \
    .option("password", "password") \
    .option("driver", "org.postgresql.Driver") \
    .mode("overwrite") \
    .save()


# Stop Spark sesssion
spark.stop()

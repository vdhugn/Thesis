# For executing Nifi Processor

import requests
import json
import time

from time import sleep

from airflow import DAG
from airflow.operators.python_operator import PythonOperator
from airflow.providers.apache.spark.operators.spark_submit import SparkSubmitOperator
from airflow.utils.dates import days_ago
from airflow.providers.postgres.operators.postgres import PostgresOperator

url_nifi_api = "https://172.18.0.4:8443/nifi-api/"
USERNAME = "admin"
PASSWORD = "hung.vd214902"

def get_processor(url_nifi_api: str, processor_id: str, token=None):
    # Authorization header
    header = {
        "Content-Type": "application/json",
        "Authorization": "Bearer {}".format(token),
    }

    # GET processor and parse to JSON
    response = requests.get(url_nifi_api + f"processors/{processor_id}", headers=header, verify=False)
    return json.loads(response.content)


def get_processor_state(url_nifi_api: str, processor_id: str, token=None):
    # Authorization header
    if token is None:
        header = {"Content-Type": "application/json"}
    else:
        header = {
            "Content-Type": "application/json",
            "Authorization": "Bearer {}".format(token),
        }

    # GET processor and parse to JSON
    response = requests.get(
        url_nifi_api + f"processors/{processor_id}/state", headers=header, verify=False
    )
    return json.loads(response.content)


def get_token(url_nifi_api, access_payload):
    header = {
        "Accept-Encoding": "gzip, deflate, br",
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "*/*",
    }
    data = access_payload  # {"username": ..., "password": ...}
    response = requests.post(
        url_nifi_api + "access/token", headers=header, data=data, verify=False
    )
    return response.content.decode("ascii")

def update_processor_status(processor_id: str, new_state: str, token, url_nifi_api):
    # Retrieve processor from `/processors/{processor_id}`
    processor = get_processor(url_nifi_api, processor_id, token)

    # Create a JSON with the new state and the processor's revision
    put_dict = {
        "revision": processor["revision"],
        "state": new_state,
        "disconnectedNodeAcknowledged": True,
    }

    # Dump JSON and POST processor
    payload = json.dumps(put_dict).encode("utf8")
    header = {
        "Content-Type": "application/json",
        "Authorization": "Bearer {}".format(token),
    }
    response = requests.put(
        url_nifi_api + f"processors/{processor_id}/run-status",
        headers=header,
        data=payload,
	verify=False
    )
    return response


def get_queue_size(connection_id, url_nifi_api, token):
    response = requests.get(
        f"{url_nifi_api}connections/{connection_id}",
        headers={"Authorization": f"Bearer {token}"},
	verify=False
    )
    content = response.json()
    return int(content["status"]["aggregateSnapshot"]["flowFilesQueued"])


def trigger_flow(processor_id, connection_id, url_nifi_api, access_payload):
    token = get_token(url_nifi_api, access_payload)

    # Start NiFi processor
    update_processor_status(processor_id, "RUNNING", token, url_nifi_api)
    sleep(5)
    update_processor_status(processor_id, "STOPPED", token, url_nifi_api)

    # Poll connection queue
    timeout = 180
    start = time.time()
    while True:
        queued = get_queue_size(connection_id, url_nifi_api, token)
        if queued == 0:
            print(f"Queue {connection_id} is empty, done.")
            break
        elif time() - start > timeout:
            raise TimeoutError(f"Polling timeout for connection {connection_id}")
        sleep(5)


def trigger_nifi_flow1():
    return trigger_flow(
        processor_id="111d1663-1197-1007-548b-2e2ec903906f",
        connection_id="10071197-110a-1663-d91f-c0ba696e12ea",
        url_nifi_api=url_nifi_api,
        access_payload={"username": USERNAME, "password": PASSWORD}
    )


def trigger_nifi_flow2():
    return trigger_flow(
        processor_id="10071197-111d-1663-7b25-efe41152ff0c",
        connection_id="1007119c-111d-1663-0714-c81bf4577adc",
        url_nifi_api=url_nifi_api,
        access_payload={"username": USERNAME, "password": PASSWORD}
    )

def trigger_nifi_flow3():
    return trigger_flow(
        processor_id="111d1663-1197-1007-d6de-504fc537d1d6",
        connection_id="1196100b-1663-110a-9e95-11bfa63d838d",
        url_nifi_api=url_nifi_api,
        access_payload={"username": USERNAME, "password": PASSWORD}
    )



default_args = {
    'owner': 'airflow',
    'retries': 1,
}

#Air flow DAG
with DAG(
    dag_id="test_workflow",
    schedule_interval="*/10 * * * *",
    start_date=days_ago(2),
    catchup=False,
) as dag:

    t1 = PythonOperator(
        task_id="trigger_nifi_api1",
        python_callable=trigger_nifi_flow1,
    )

    t2 = PythonOperator(
        task_id="trigger_nifi_api2",
        python_callable=trigger_nifi_flow2,
    )

    t3 = PythonOperator(
        task_id="trigger_nifi_api3",
        python_callable=trigger_nifi_flow3,
    )

    t4 = SparkSubmitOperator(
        task_id="submit_spark_job",
        application="/spark/sparkjob/processing.py",
        conn_id="spark-default",
        conf={"spark.master": "spark://spark-afl:7077"},
        dag=dag,
    )

    [t1,t2,t3] >> t4

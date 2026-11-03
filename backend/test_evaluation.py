import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from detector.evaluation import EvaluationPipeline, LabelledWorkload, get_default_synthetic_dataset
from detector.detection_engine import DetectionEngine, TelemetryData
from app import app


class TestEvaluationPipeline:
    def test_default_dataset_distribution(self):
        dataset = get_default_synthetic_dataset()
        assert len(dataset) == 100
        threats = [w for w in dataset if w.is_cryptojacking]
        benign = [w for w in dataset if not w.is_cryptojacking]
        assert len(threats) == 50
        assert len(benign) == 50

    def test_evaluation_metrics_calculation(self):
        pipeline = EvaluationPipeline()
        engine = DetectionEngine(medium_threshold=35)
        results = pipeline.evaluate(engine=engine, threshold=35)

        metrics = results["metrics"]
        cm = results["confusion_matrix"]
        meta = results["metadata"]

        assert meta["dataset_size"] == 100
        assert meta["benchmark_mode"] == "SYNTHETIC_LAB_ISOLATED"
        assert "disclaimer" in meta

        # Confusion Matrix Total Check
        total = cm["true_positives"] + cm["false_positives"] + cm["true_negatives"] + cm["false_negatives"]
        assert total == 100

        # High accuracy on synthetic benchmark
        assert metrics["accuracy"] >= 0.80
        assert metrics["recall"] >= 0.85
        assert metrics["f1_score"] >= 0.80
        assert 0.0 <= metrics["false_positive_rate"] <= 0.40

    def test_confusion_matrix_structure(self):
        pipeline = EvaluationPipeline()
        results = pipeline.evaluate(threshold=35)
        cm = results["confusion_matrix"]

        assert len(cm["matrix_2x2"]) == 2
        assert len(cm["matrix_2x2"][0]) == 2
        assert len(cm["matrix_2x2"][1]) == 2
        assert cm["matrix_2x2"][0][0] == cm["true_negatives"]
        assert cm["matrix_2x2"][0][1] == cm["false_positives"]
        assert cm["matrix_2x2"][1][0] == cm["false_negatives"]
        assert cm["matrix_2x2"][1][1] == cm["true_positives"]

    def test_threshold_tradeoff_behavior(self):
        pipeline = EvaluationPipeline()
        # High threshold (e.g. 75) should reduce False Positives compared to very low threshold (e.g. 15)
        strict_results = pipeline.evaluate(threshold=75)
        sensitive_results = pipeline.evaluate(threshold=15)

        strict_fp = strict_results["confusion_matrix"]["false_positives"]
        sensitive_fp = sensitive_results["confusion_matrix"]["false_positives"]

        assert strict_fp <= sensitive_fp

    def test_custom_synthetic_workloads(self):
        custom_data = [
            LabelledWorkload(
                telemetry=TelemetryData(cpu_usage=99.0, memory_usage=90.0, process_name="xmrig", process_runtime_seconds=10000, network_destination="pool.supportxmr.com:3333"),
                is_cryptojacking=True, description="Known miner", category="Miner"
            ),
            LabelledWorkload(
                telemetry=TelemetryData(cpu_usage=10.0, memory_usage=15.0, process_name="systemd-journald", process_runtime_seconds=100000),
                is_cryptojacking=False, description="OS logging", category="Benign"
            )
        ]
        pipeline = EvaluationPipeline(dataset=custom_data)
        results = pipeline.evaluate(threshold=35)

        assert results["metrics"]["accuracy"] == 1.0
        assert results["metrics"]["precision"] == 1.0
        assert results["metrics"]["recall"] == 1.0
        assert results["metrics"]["f1_score"] == 1.0
        assert results["metrics"]["false_positive_rate"] == 0.0

    def test_empty_dataset_handling(self):
        pipeline = EvaluationPipeline(dataset=[])
        results = pipeline.evaluate(threshold=35)
        metrics = results["metrics"]
        assert metrics["accuracy"] == 0.0
        assert metrics["precision"] == 0.0
        assert metrics["recall"] == 0.0
        assert metrics["f1_score"] == 0.0
        assert metrics["false_positive_rate"] == 0.0
        assert results["metadata"]["dataset_size"] == 0
        assert len(results["sample_details"]) == 0

    def test_per_class_and_version_metadata(self):
        pipeline = EvaluationPipeline()
        results = pipeline.evaluate(threshold=35)
        meta = results["metadata"]
        pcm = results["per_class_metrics"]

        assert meta["detector_version"] == "v1.2.0"
        assert meta["schema_version"] == "bmg-evidence-v1.0"
        assert meta["reproduction_command"] == "python -m detector.evaluation"
        assert len(results["sample_details"]) == 100
        assert "sample_id" in results["sample_details"][0]

        assert pcm["cryptojacking_threats"]["sample_count"] == 50
        assert pcm["benign_workloads"]["sample_count"] == 50
        assert pcm["cryptojacking_threats"]["true_positives"] == 50
        assert pcm["benign_workloads"]["true_negatives"] >= 30


class TestEvaluationEndpoints:
    @pytest.fixture
    def client(self):
        app.config["TESTING"] = True
        with app.test_client() as client:
            yield client

    def test_get_evaluation_results_endpoint(self, client):
        res = client.get("/evaluation/results?threshold=35")
        assert res.status_code == 200
        data = res.get_json()
        assert "metrics" in data
        assert "confusion_matrix" in data
        assert "metadata" in data
        assert data["metadata"]["dataset_size"] == 100
        assert data["metrics"]["accuracy"] > 0

    def test_post_evaluation_run_endpoint(self, client):
        res = client.post("/evaluation/run", json={"threshold": 40})
        assert res.status_code == 200
        data = res.get_json()
        assert data["metadata"]["evaluated_threshold"] == 40
        assert "matrix_2x2" in data["confusion_matrix"]

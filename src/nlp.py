"""
NLP module for detecting verbal abuse in transcribed workplace audio.

Uses a pre-trained toxic-bert model (unitary/toxic-bert) from HuggingFace
to classify transcribed text into toxicity categories:
    toxic, severe_toxic, obscene, threat, insult, identity_hate

The Arduino Nano 33 BLE Sense mic captures audio → an external
speech-to-text service transcribes it → this module classifies the text.

This is designed as an OPT-IN worker reporting tool, not passive
surveillance. Workers voluntarily submit audio/text for analysis.
"""

from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification


# Toxicity labels output by toxic-bert
LABELS = ["toxic", "severe_toxic", "obscene", "threat", "insult", "identity_hate"]

# Thresholds for flagging — scores above these trigger an alert
DEFAULT_THRESHOLDS = {
    "toxic": 0.5,
    "severe_toxic": 0.3,
    "obscene": 0.5,
    "threat": 0.3,
    "insult": 0.5,
    "identity_hate": 0.3,
}


class VerbalAbuseDetector:
    """Classifies transcribed text for verbal abuse / toxic speech."""

    def __init__(self, model_name="unitary/toxic-bert", thresholds=None):
        """Load the pre-trained model.

        Args:
            model_name: HuggingFace model ID for toxicity classification.
            thresholds: dict mapping label → float threshold (0-1).
                        Scores above threshold are flagged.
        """
        self.thresholds = thresholds or DEFAULT_THRESHOLDS
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_name)
        self.pipe = pipeline(
            "text-classification",
            model=self.model,
            tokenizer=self.tokenizer,
            top_k=None,     # return all labels with scores
            truncation=True,
            max_length=512,
        )

    def classify(self, text):
        """Classify a single text snippet.

        Args:
            text: transcribed speech string

        Returns:
            dict with keys:
                scores: {label: float} for all 6 toxicity categories
                flagged: list of labels that exceeded their threshold
                is_abusive: bool — True if any label was flagged
                severity: float 0-1, max score across all categories
        """
        results = self.pipe(text)[0]
        scores = {r["label"]: r["score"] for r in results}

        flagged = [
            label for label, score in scores.items()
            if score >= self.thresholds.get(label, 0.5)
        ]

        return {
            "text": text,
            "scores": scores,
            "flagged": flagged,
            "is_abusive": len(flagged) > 0,
            "severity": max(scores.values()) if scores else 0.0,
        }

    def classify_batch(self, texts):
        """Classify multiple text snippets.

        Args:
            texts: list of transcribed speech strings

        Returns:
            list of result dicts (same format as classify)
        """
        all_results = self.pipe(texts)
        outputs = []
        for text, results in zip(texts, all_results):
            scores = {r["label"]: r["score"] for r in results}
            flagged = [
                label for label, score in scores.items()
                if score >= self.thresholds.get(label, 0.5)
            ]
            outputs.append({
                "text": text,
                "scores": scores,
                "flagged": flagged,
                "is_abusive": len(flagged) > 0,
                "severity": max(scores.values()) if scores else 0.0,
            })
        return outputs

    def get_abuse_summary(self, results):
        """Summarize abuse detection results for reporting.

        Args:
            results: list of result dicts from classify or classify_batch

        Returns:
            dict with aggregate stats for a reporting period
        """
        total = len(results)
        if total == 0:
            return {"total": 0, "abusive_count": 0, "abuse_rate": 0.0,
                    "avg_severity": 0.0, "category_counts": {}}

        abusive = [r for r in results if r["is_abusive"]]
        category_counts = {}
        for r in results:
            for label in r["flagged"]:
                category_counts[label] = category_counts.get(label, 0) + 1

        return {
            "total": total,
            "abusive_count": len(abusive),
            "abuse_rate": len(abusive) / total,
            "avg_severity": sum(r["severity"] for r in results) / total,
            "max_severity": max(r["severity"] for r in results),
            "category_counts": category_counts,
        }


# --- Standalone usage ---

if __name__ == "__main__":
    print("Loading verbal abuse detector...")
    detector = VerbalAbuseDetector()

    test_texts = [
        "Good morning, how is the production line running today?",
        "You're an idiot, get back to work or you're fired!",
        "The temperature in section B seems a bit high.",
        "If you complain again I will make sure you regret it.",
        "Great job on meeting the safety targets this week.",
    ]

    print("\n=== Verbal Abuse Detection Demo ===\n")
    results = detector.classify_batch(test_texts)
    for r in results:
        flag = "FLAGGED" if r["is_abusive"] else "OK"
        print(f"[{flag}] (severity: {r['severity']:.3f}) \"{r['text']}\"")
        if r["flagged"]:
            print(f"        Categories: {', '.join(r['flagged'])}")
        print()

    summary = detector.get_abuse_summary(results)
    print("=== Summary ===")
    print(f"  Total analyzed: {summary['total']}")
    print(f"  Abusive: {summary['abusive_count']} ({summary['abuse_rate']:.0%})")
    print(f"  Avg severity: {summary['avg_severity']:.3f}")
    print(f"  Category breakdown: {summary['category_counts']}")

import json
import os
import sys
from ragas import EvaluationDataset
from ragas import evaluate
from ragas.llms import LangchainLLMWrapper
from ragas.metrics import LLMContextRecall, LLMContextPrecisionWithReference, Faithfulness, ResponseRelevancy
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from utils.langchain import *

with open("dataset/answers_rag_v1.json", "r") as f:
    dataset = json.load(f)

#print(dataset)
#dataset = dataset[:1]
evaluator_llm = LangchainLLMWrapper(get_llm(custom=False))

individual_results = []

for example in dataset:
    eval_ds = EvaluationDataset.from_list([example])
    result = evaluate(
        dataset=eval_ds,
        metrics=[
            Faithfulness(),
            ResponseRelevancy(),
            LLMContextPrecisionWithReference(),
            LLMContextRecall(),
        ],
        llm=evaluator_llm,
    )
    result_dict = {
        "faithfulness": result['faithfulness'],
        "answer_relevancy": result['answer_relevancy'],
        "llm_context_precision_with_reference": result['llm_context_precision_with_reference'],
        "context_recall": result['context_recall'],
    }

    result_dict["user_input"] = example["user_input"]
    result_dict["response"] = example["response"]
    individual_results.append(result_dict)

with open("dataset/per_question_ragas_scores.jsonl", "w") as f:
    for item in individual_results:
        f.write(json.dumps(item) + "\n")

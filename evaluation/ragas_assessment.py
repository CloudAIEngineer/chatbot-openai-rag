import json
import os
from ragas import EvaluationDataset
from ragas import evaluate
from ragas.llms import LangchainLLMWrapper
from ragas.metrics import LLMContextRecall, LLMContextPrecisionWithReference, Faithfulness, ResponseRelevancy
from utils.langchain import *

sample_queries = []
expected_responses = []

script_dir = os.path.dirname(os.path.abspath(__file__))  
dataset_path = os.path.join(script_dir, "dataset/evaluation.jsonl")

with open(dataset_path, 'r') as file:
    for line in file:
        data = json.loads(line)
        sample_queries.append(data['question'])
        expected_responses.append(data['expected_response'])

# Initialize Pinecone and QA Chain
vectorstore = initialize_pinecone()
chain = setup_qa_chain(vectorstore)

dataset = []

for query, reference in zip(sample_queries, expected_responses):

    response_data = chain.invoke({"input": query, "placeholder": []})
    relevant_docs = response_data["context"]
    response = response_data["answer"]

    dataset.append(
        {
            "user_input": query,
            "retrieved_contexts": [rdoc.page_content for rdoc in relevant_docs],
            "response": response,
            "reference": reference,
        }
    )

print(dataset)

evaluation_dataset = EvaluationDataset.from_list(dataset)

evaluator_llm = LangchainLLMWrapper(get_llm())

result = evaluate(
    dataset=evaluation_dataset,
    metrics=[
        LLMContextRecall(),
        LLMContextPrecisionWithReference(),
        Faithfulness(),
        ResponseRelevancy(),
    ],
    llm=evaluator_llm,
)

print(result)

import json
import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from utils.langchain import *

sample_queries = []
expected_responses = []

script_dir = os.path.dirname(os.path.abspath(__file__))  
dataset_path = os.path.join(script_dir, "dataset/evaluation_qa_angry.jsonl")

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
answers_path = os.path.join(script_dir, "dataset/answers_angry_v1.json")
with open(answers_path, "w") as f:  
    json.dump(dataset, f, indent=4)
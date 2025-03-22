from pinecone import Pinecone, ServerlessSpec
import json
import openai
from dotenv import load_dotenv
import os

load_dotenv()

def delete_index(index_name="virgin-trains-index"):
    pc = Pinecone(os.getenv("PINECONE_API_KEY"))
    pc.delete_index(index_name)

def get_pinecone_index(index_name="virgin-trains-index", dimension=1536, metric="cosine"):    
    pc = Pinecone(os.getenv("PINECONE_API_KEY"))
    existing_indexes = pc.list_indexes()

    if any(index['name'] == index_name for index in existing_indexes):
        print(f"Index {index_name} already exists.")
    else:
        pc.create_index(
            name=index_name, 
            dimension=dimension, 
            metric=metric,
            spec=ServerlessSpec(
                cloud="aws",
                region="us-east-1"
            )
        )
        print(f"Index {index_name} created successfully.")
    
    index = pc.Index(index_name)
    return index

# Load JSON file with documenst
def load_json_file(file_path):
    with open(file_path, 'r') as f:
        return json.load(f)

# Turn document into embedding
def generate_embeddings(text):
    response = openai.embeddings.create(
        model="text-embedding-ada-002",
        input=[text]
    )
    embeddings = response.data[0].embedding
    return embeddings

# Index a file into Pinecone
def index_file(index, file_path):
    data = load_json_file(file_path)
    vectors = []
    for item in data:
        vector = {
            "id": item["metadata"]["id"],
            "metadata": {
                "text": item["text"],
                **item["metadata"]
            },
            "values": generate_embeddings(item["text"])
        }
        vectors.append(vector)

    index.upsert(vectors=vectors)

def index_knowledge_base_files(knowledge_base_folder, files_to_index, index):
    for file in files_to_index:
        file_path = os.path.join(knowledge_base_folder, file)
        
        if os.path.exists(file_path):
            print(f"Indexing file: {file_path}")
            index_file(index, file_path)
        else:
            print(f"File not found: {file_path}")

def index_data(with_delete = False, files_to_index = ["schedule.json"]):
    if with_delete:
        delete_index();

    index = get_pinecone_index()
    knowledge_base_folder = "documents"
    index_knowledge_base_files(knowledge_base_folder, files_to_index, index)

    print("Indexing complete.")
    print_index_info(index)

# Debug: print some indexed entries
def print_index_info(index):
    ids_to_fetch = ["train_4579"]
    result = index.fetch(ids=ids_to_fetch)
    #print("Fetch result:", result)
    print("Result type:", type(result))

index_data(True)
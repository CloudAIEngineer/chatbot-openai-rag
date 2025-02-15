from pinecone import Pinecone, ServerlessSpec
import json
import openai
from dotenv import load_dotenv
import os

load_dotenv()

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

# Load JSON files
def load_json_file(file_path):
    with open(file_path, 'r') as f:
        return json.load(f)

# Function to index data into Pinecone
def index_data(index, file_path):
    data = load_json_file(file_path)
    vectors = []
    for item in data:
        vector = {
            "id": item["metadata"]["id"],
            "metadata": {
                "id": item["metadata"]["id"],
                "text": item["text"],
                **item["metadata"]
            },
            "values": generate_embeddings(item["text"])
        }
        vectors.append(vector)

    index.upsert(vectors=vectors)

def generate_embeddings(text):
    response = openai.embeddings.create(
        model="text-embedding-ada-002",
        input=[text]
    )
    embeddings = response.data[0].embedding
    return embeddings

def index_knowledge_base_files(knowledge_base_folder, files_to_index, index):
    for file in files_to_index:
        file_path = os.path.join(knowledge_base_folder, file)
        
        if os.path.exists(file_path):
            print(f"Indexing file: {file_path}")
            index_data(index, file_path)  # Function for indexing data into Pinecone
        else:
            print(f"File not found: {file_path}")

# Get or create index
index = get_pinecone_index()

# Index knowledge files
knowledge_base_folder = "dataset/knowledge_base"
files_to_index = ["schedule.json", "tickets.json", "support.json"]
index_knowledge_base_files(knowledge_base_folder, files_to_index, index)

# Debug: print some indexed entries
def print_index_info(index):
    ids_to_fetch = ["train_4579"]
    result = index.fetch(ids=ids_to_fetch)
    #print("Fetch result:", result)
    print("Result type:", type(result))

#print_index_info(index)
print("Indexing complete.")

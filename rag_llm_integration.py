from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from pinecone import Pinecone
from langchain_pinecone import Pinecone as PineconeVector
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Pinecone
pc = Pinecone(api_key=os.environ.get("PINECONE_API_KEY"))

# Define the Pinecone index
index_name = "virgin-trains-index"
index = pc.Index(index_name)


# Initialize Pinecone vector store
embeddings = OpenAIEmbeddings(model="text-embedding-ada-002")
vectorstore = PineconeVector.from_existing_index(
    index_name=index_name, 
    embedding=embeddings
)

# Define the custom prompt for RAG + LLM
prompt_template = """
You are an intelligent assistant trained to provide answers based on the following context. 
Context:
{context}

Please answer the question in a concise and clear manner.
Question: {question}
"""

# Create a prompt with LangChain
prompt = PromptTemplate(input_variables=["context", "question"], template=prompt_template)

# Setup the LLM using your fine-tuned model
llm = ChatOpenAI(model="ft:gpt-4o-mini-2024-07-18:smart-cloud::Az1rmOcz")

# Combine Retrieval (from Pinecone) with the LLM
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="map_reduce",
    retriever=vectorstore.as_retriever(search_kwargs={"k": 3}),
    return_source_documents=True
)

# Example query to test
query = "What are the departure times for train 5680?"
result = qa_chain.invoke(query)
'''retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
docs = retriever.invoke(query)
print(docs)'''

# Print the result
print(result['result'])
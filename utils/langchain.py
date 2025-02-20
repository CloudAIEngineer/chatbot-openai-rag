import os
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_pinecone import Pinecone as PineconeVector

# Initialize Pinecone
def initialize_pinecone():
    embeddings = OpenAIEmbeddings(model="text-embedding-ada-002")
    vectorstore = PineconeVector.from_existing_index(
        index_name=os.environ.get("PINECONE_DATABASE"),
        embedding=embeddings
    )
    return vectorstore

def setup_qa_chain(vectorstore):
    prompt_template = """
    You are an intelligent assistant trained to provide answers based on the following context. 
    Context:
    {context}

    Please answer the question in a concise and clear manner.
    Question: {question}
    """
    prompt = PromptTemplate(input_variables=["context", "question"], template=prompt_template)

    # Setup fine-tuned model
    llm = ChatOpenAI(model=os.environ.get("FINE_TUNED_MODEL"))

    # Combine Retrieval (from Pinecone) with the LLM
    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="map_reduce",
        retriever=vectorstore.as_retriever(search_kwargs={"k": 3}),
        return_source_documents=True
    )
    return qa_chain

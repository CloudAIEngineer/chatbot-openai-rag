import os
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from pinecone import Pinecone
from langchain_pinecone import Pinecone as PineconeVector

# Initialize Pinecone and other dependencies
def initialize_pinecone():
    # Get Pinecone API key and initialize
    # Should be replaces to secret manager
    pc = Pinecone(api_key=os.environ.get("PINECONE_API_KEY"))
    index_name = os.environ.get("PINECONE_DATABASE")
    index = pc.Index(index_name)

    # Initialize Pinecone vector store
    embeddings = OpenAIEmbeddings(model="text-embedding-ada-002")
    vectorstore = PineconeVector.from_existing_index(
        index_name=index_name, 
        embedding=embeddings
    )
    return vectorstore

# Setup LangChain and RetrievalQA
def setup_qa_chain(vectorstore):
    # Define custom prompt
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

import os
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_pinecone import Pinecone as PineconeVector
from langchain_core.prompts import ChatPromptTemplate
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain

# Initialize vector database and specify embedding type
def initialize_pinecone():
    vectorstore = PineconeVector.from_existing_index(
        index_name=os.environ.get('PINECONE_DATABASE'),
        embedding=OpenAIEmbeddings(model='text-embedding-ada-002')
    )
    return vectorstore

# Create prompt template
def create_prompt():
    system_prompt = (
        "You are a railway service assistant. "
        "Use the following documents about trains:\n\n"
        "Context: {context}\n\n"
        "Use the provided conversation history for context, "
        "but answer ONLY the latest user question as precisely as possible."
    )

    return ChatPromptTemplate([
        ("system", system_prompt),
        ("placeholder", "{conversation}"),
        ("human", "{input}")
    ])

# Initialize a chain to send requests to the LLM
def setup_qa_chain(vectorstore):
    prompt = create_prompt()
    
    # 'FINETUNED_MODEL' environment variable should contain LLM model code
    llm = ChatOpenAI(model=os.environ.get("FINETUNED_MODEL"))
    
    # Ssearch limit of 3 results
    retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

    qa_chain = create_stuff_documents_chain(llm, prompt)
    chain = create_retrieval_chain(retriever, qa_chain)

    return chain

def get_llm():
    return ChatOpenAI(model=os.environ.get("FINETUNED_MODEL"))
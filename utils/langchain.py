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
        "You are a railway service assistant, trained to handle customer inquiries with accuracy and professionalism. "
        "Always base your answers strictly on the provided documents.\n\n"

        "Context: {context}\n\n"

        "Guidelines:\n"
        "- If the user asks about a train schedule, ONLY provide an answer if the context contains complete and reliable information. "
        "If the details are missing or unclear, politely inform the user that you don’t have the necessary details instead of making assumptions.\n"
        "- If the user is expressing frustration or anger without asking a specific question, respond politely and empathetically, using a calm and professional tone.\n"
        "- If the user asks something specific that is NOT covered in the context, inform them that you don't have that information and recommend they call customer service at 568.\n"
        "- Do NOT use past knowledge, external sources, or assumptions—respond ONLY using the given context."
    )

    return ChatPromptTemplate([
        ("system", system_prompt),
        ("placeholder", "{conversation}"),
        ("human", "{input}")
    ])

# Initialize a chain to send requests to the LLM
def setup_qa_chain(vectorstore):
    prompt = create_prompt()
    
    # Get non-tuned gpt model
    llm = get_llm(False)
    
    # Ssearch limit of 3 results
    retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

    qa_chain = create_stuff_documents_chain(llm, prompt)
    chain = create_retrieval_chain(retriever, qa_chain)

    return chain

def get_llm(custom=True):
    model_name = os.environ.get("FINETUNED_MODEL" if custom else "ORIGINAL_MODEL")
    return ChatOpenAI(model=model_name)
import os

import gradio as gr
from llama_index.core import SimpleDirectoryReader, VectorStoreIndex
from llama_index.embeddings.mixedbreadai import MixedbreadAIEmbedding
from llama_index.llms.groq import Groq
from llama_parse import LlamaParse


llama_cloud_key = os.environ.get("LLAMA_CLOUD_API_KEY")
groq_key = os.environ.get("GROQ_API_KEY")
mxbai_key = os.environ.get("MXBAI_API_KEY")
if not (llama_cloud_key and groq_key and mxbai_key):
    raise ValueError(
        "API Keys not found! Ensure they are passed to the Docker container."
    )


llm_model_name = "llama-3.3-70b-versatile"
embed_model_name = "mixedbread-ai/mxbai-embed-large-v1"

parser = LlamaParse(api_key=llama_cloud_key, result_type="markdown")


file_extractor = {
    ".pdf": parser,
    ".docx": parser,
    ".doc": parser,
    ".txt": parser,
    ".csv": parser,
    ".xlsx": parser,
    ".pptx": parser,
    ".html": parser,
    ".jpg": parser,
    ".jpeg": parser,
    ".png": parser,
    ".webp": parser,
    ".svg": parser,
}


embed_model = MixedbreadAIEmbedding(api_key=mxbai_key, model_name=embed_model_name)


llm = Groq(model="llama-3.3-70b-versatile", api_key=groq_key)


def load_files(file_path: str):
    global vector_index
    if not file_path:
        return "No file path provided. Please upload a file."
    
    valid_extensions = ', '.join(file_extractor.keys())
    if not any(file_path.endswith(ext) for ext in file_extractor):
        return f"The parser can only parse the following file types: {valid_extensions}"

    document = SimpleDirectoryReader(input_files=[file_path], file_extractor=file_extractor).load_data()
    vector_index = VectorStoreIndex.from_documents(document, embed_model=embed_model)
    print(f"Parsing completed for: {file_path}")
    filename = os.path.basename(file_path)
    return f"Ready to provide responses based on: {filename}"


def respond(message, history):
    try:
        query_engine = vector_index.as_query_engine(streaming=True, llm=llm)
        streaming_response = query_engine.query(message)
        partial_text = ""
        for new_text in streaming_response.response_gen:
            partial_text += new_text
            yield partial_text
    except (AttributeError, NameError):
        print("An error occurred while processing your request.")
        yield "Please upload the file to begin chat."


def clear_state():
    global vector_index
    vector_index = None
    return [None, None, None]




with gr.Blocks(
    theme=gr.themes.Default(
        primary_hue="green",
        secondary_hue="blue",
        font=[gr.themes.GoogleFont("Poppins")],
    ),
    css="""
        footer {visibility: hidden;}
        body {background-color: black;}
        .gradio-container {background-color: black; color: white;}
        .gr-button {background-color: #4CAF50; color: white;}
        .gr-textbox {background-color: #333333; color: white;}
        .gr-chatbot {background-color: #333333; color: white;}
        .gr-markdown {color: white;}
        .gr-header {background-color: #333333; padding: 10px; text-align: center; color: white;}
    """
) as fin:
    gr.Markdown("<div class='gr-header'># Finalyse Doc </div>")
    
    with gr.Row():
        with gr.Column(scale=1):
            file_input = gr.File(
                file_count="single", type="filepath", label="Upload Document"
            )
            with gr.Row():
                btn = gr.Button("Submit", variant="primary")
                clear = gr.Button("Clear")
            output = gr.Textbox(label="Status")
        with gr.Column(scale=3):
            chatbot = gr.ChatInterface(
                fn=respond,
                chatbot=gr.Chatbot(height=300),
                theme="soft",
                # show_progress="full", # Removed this line
                textbox=gr.Textbox(
                    placeholder="Ask questions about the uploaded document!",
                ),
            )

    btn.click(fn=load_files, inputs=file_input, outputs=output)
    clear.click(
        fn=clear_state,  
        outputs=[file_input, output],
    )

if __name__ == "__main__":
    fin.launch(share=True)

FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt /app

RUN pip install --no-cache-dir -r requirements.txt

COPY app.py /app

EXPOSE 7860

ENV GRADIO_SERVER_NAME="0.0.0.0"

CMD ["python", "app.py"]  
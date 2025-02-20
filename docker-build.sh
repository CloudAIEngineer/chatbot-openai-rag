docker build --platform linux/amd64 --build-arg provenance="false" -t lambda-chatbot .
docker tag lambda-chatbot:latest 445567098565.dkr.ecr.eu-central-1.amazonaws.com/serverless-finetuning-openai-dev:latest
docker push 445567098565.dkr.ecr.eu-central-1.amazonaws.com/serverless-finetuning-openai-dev:latest
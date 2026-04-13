FROM public.ecr.aws/amazonlinux/amazonlinux:latest

RUN yum update -y && \
    yum install -y python3 python3-pip

RUN pip3 install fastapi uvicorn

WORKDIR /app
COPY . /app

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "80"]
FROM node:20

WORKDIR /app

RUN apt-get update && apt-get install -y \
    bash \
    python3 \
    python3-pip \
    build-essential \
    libffi-dev \
    libopenblas-dev \
    liblapack-dev

COPY package*.json ./
COPY prisma ./prisma
COPY requirements.txt ./

RUN npm install

RUN npx prisma generate

RUN pip3 install --break-system-packages --upgrade pip && \
    pip3 install --break-system-packages -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["npm", "start"]

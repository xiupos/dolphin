FROM node:16.8.0-alpine3.13 AS base

ENV NODE_ENV=production

WORKDIR /dolphin

FROM base AS builder

RUN apk add --no-cache \
    autoconf \
    automake \
    file \
    g++ \
    gcc \
    libc-dev \
    libtool \
    make \
    nasm \
    pkgconfig \
    python3 \
    zlib-dev

COPY package.json yarn.lock ./
RUN yarn install
COPY . ./
RUN yarn build

FROM base AS runner

RUN apk add --no-cache \
    ffmpeg \
    tini

ENTRYPOINT ["/sbin/tini", "--"]

COPY --from=builder /dolphin/node_modules ./node_modules
COPY --from=builder /dolphin/built ./built
COPY . ./

CMD ["npm", "run", "migrateandstart"]

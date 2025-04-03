#!/usr/bin/bash
set -ex

apt-get update -y
apt-get install -y \
  curl \
  wget \
  python3-pip \
  build-essential \
  zip \
  unzip
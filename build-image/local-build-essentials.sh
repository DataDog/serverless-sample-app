#!/usr/bin/bash
set -ex

apt-get update -y
apt-get install software-properties-common -y
add-apt-repository ppa:dotnet/backports --yes
add-apt-repository ppa:deadsnakes/ppa --yes
apt-get update -y
apt-get install -y \
  curl \
  wget \
  git-all \
  python3-pip \
  python3.13 \
  python-is-python3 \
  build-essential \
  zip \
  unzip
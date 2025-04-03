#!/usr/bin/bash
set -ex

apt-get install git -y
apt install zip -y
apt install unzip -y

echo "Installing Go"
# Clean up any previous installation
rm -f go.tar.gz
rm -rf /usr/local/go

# Download and install Go
wget https://go.dev/dl/go1.24.1.linux-amd64.tar.gz -O go.tar.gz
tar -xzvf go.tar.gz -C /usr/local

# Set up Go environment
export GOROOT=/usr/local/go
export GOPATH=$HOME/go
export PATH=$GOROOT/bin:$GOPATH/bin:$PATH

# Verify installation
which go
go version

# Add to profile for persistence
echo "export GOROOT=/usr/local/go" >> ~/.bashrc
echo "export GOPATH=\$HOME/go" >> ~/.bashrc
echo "export PATH=\$GOROOT/bin:\$GOPATH/bin:\$PATH" >> ~/.bashrc

echo "Cloning GitHub repo"
git clone https://github.com/DataDog/serverless-sample-app.git

echo "Compile Go, Rust & Java code to speed up first deployment"
cd serverless-sample-app && ./build.sh
#!/usr/bin/bash
set -ex

echo "Installing Node22"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash &&
  export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"                   # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" # This loads nvm bash_completion

# Now we can use nvm
nvm install v22.14.0

echo "Installing AWS CDK"
npm install -g aws-cdk
cdk --help

echo "Installing .NET"
apt install -y dotnet-sdk-9.0
export DOTNET_ROOT=$HOME/.dotnet
export PATH=$PATH:$DOTNET_ROOT:$DOTNET_ROOT/tools
dotnet --version
dotnet new install Amazon.Lambda.Templates
dotnet tool install -g Amazon.Lambda.Tools

echo "Installing Java"
wget -O - https://apt.corretto.aws/corretto.key | gpg --dearmor -o /usr/share/keyrings/corretto-keyring.gpg &&
  echo "deb [signed-by=/usr/share/keyrings/corretto-keyring.gpg] https://apt.corretto.aws stable main" | tee /etc/apt/sources.list.d/corretto.list
apt-get update -y
apt-get install -y java-22-amazon-corretto-jdk
java -version

echo "Installing Maven"
wget https://dlcdn.apache.org/maven/maven-3/3.9.11/binaries/apache-maven-3.9.11-bin.tar.gz -P /tmp
tar xf /tmp/apache-maven-*.tar.gz -C /opt
export M3_HOME=/opt/apache-maven-3.9.11
export MAVEN_HOME=/opt/apache-maven-3.9.11
export PATH=${M3_HOME}/bin:${PATH}
mvn --version

echo "Installing Quarkus CLI"
curl -Ls https://sh.jbang.dev | bash -s - trust add https://repo1.maven.org/maven2/io/quarkus/quarkus-cli/
curl -Ls https://sh.jbang.dev | bash -s - app install --fresh --force quarkus@quarkusio
source ~/.profile

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
echo "export GOROOT=/usr/local/go" >>~/.bashrc
echo "export GOPATH=\$HOME/go" >>~/.bashrc
echo "export PATH=\$GOROOT/bin:\$GOPATH/bin:\$PATH" >>~/.bashrc

echo "Installing Rust"
curl https://sh.rustup.rs -sSf | sh -s -- -y
. "$HOME/.cargo/env"
pip3 install cargo-lambda
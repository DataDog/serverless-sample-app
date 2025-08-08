#!/usr/bin/bash
set -ex

echo "Pre-compile code to speed up first deployment."
apt-get install git-all -y
git clone https://github.com/DataDog/serverless-sample-app.git /serverless-sample-app
cd /serverless-sample-app && ./build.sh

# #############################################################
# ### Install frontend and loadtesting dependencies         ###
# #############################################################

pushd /serverless-sample-app/src/frontend
npm i && docker build .
popd

pushd /serverless-sample-app/loadtest
npm i && docker build .
popd

export DOTNET_ROOT=$HOME/.dotnet
export PATH=$PATH:$DOTNET_ROOT:$DOTNET_ROOT/tools
export M3_HOME=/opt/apache-maven-3.9.11
export MAVEN_HOME=/opt/apache-maven-3.9.11
export PATH=${M3_HOME}/bin:${PATH}
export GOROOT=/usr/local/go
export GOPATH=$HOME/go
export PATH=$GOROOT/bin:$GOPATH/bin:$PATH
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"                   # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" # This loads nvm bash_completion
. "$HOME/.cargo/env"

# set environment variables
tee -a /root/.bashrc <<EOF
export DOTNET_ROOT=$HOME/.dotnet
export PATH=$PATH:$DOTNET_ROOT:$DOTNET_ROOT/tools
export M3_HOME=/opt/apache-maven-3.9.11
export MAVEN_HOME=/opt/apache-maven-3.9.11
export PATH=${M3_HOME}/bin:${PATH}
export GOROOT=/usr/local/go
export GOPATH=$HOME/go
export PATH=$GOROOT/bin:$GOPATH/bin:$PATH
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
. "$HOME/.cargo/env"
EOF

source /root/.bashrc

# Print app version information
# node --version
# dotnet --version
# java --version
# go version
# cargo --version
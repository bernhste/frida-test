FROM mcr.microsoft.com/devcontainers/base:trixie

ARG USERNAME=vscode

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        adb \
        python3 \
        python3-pip \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages frida-tools

RUN mkdir -p /commandhistory \
    && touch /commandhistory/.bash_history /commandhistory/.zsh_history \
    && chown -R $USERNAME /commandhistory \
    && echo "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" >> "/home/$USERNAME/.bashrc" \
    && echo "export HISTFILE=/commandhistory/.zsh_history\nsetopt INC_APPEND_HISTORY" >> "/home/$USERNAME/.zshrc"

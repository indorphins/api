kill -9 $(ps -ef | grep 'ngrok' | grep -v 'grep' | awk '{print $2}')
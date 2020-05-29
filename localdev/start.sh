kill -9 $(ps -ef | grep 'ngrok' | grep -v 'grep' | awk '{print $2}')
ngrok http 3001 --log=stdout > ngrok.log &

sleep 2

export NGROK_URL=$(curl --silent --max-time 10 --connect-timeout 5 \
                  --show-error http://127.0.0.1:4040/api/tunnels | \
                  sed -nE 's/.*public_url":"https:..([^"]*).*/\1/p')

kubectl delete configmap proxy-config -n test

kubectl create configmap proxy-config -n test --from-literal=NGROK_URL=${NGROK_URL}

kubectl -n test rollout restart deployment dev-proxy

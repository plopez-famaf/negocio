# Test multiple concurrent requests
for i in {1..10}; do
  curl -w "%{time_total}\n" -o /dev/null -s http://localhost/health &
done
wait

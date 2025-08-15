for i in {1..50}; do curl -w "%{http_code}\n" -o /dev/null -s http://localhost/health; done | sort | uniq -c

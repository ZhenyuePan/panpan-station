#!/usr/bin/env bash
set -euo pipefail

service_name="panpan-station"

case "${1:-start}" in
  start)
    sudo systemctl start "$service_name"
    ;;
  restart)
    sudo systemctl restart "$service_name"
    ;;
  status)
    ;;
  *)
    echo "用法: $0 [start|restart|status]" >&2
    exit 2
    ;;
esac

sudo systemctl --no-pager --full status "$service_name"

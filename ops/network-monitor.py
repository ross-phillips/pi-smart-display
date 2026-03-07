#!/usr/bin/env python3
import subprocess
import time
import logging
import signal
import sys
import os

# Configuration
CHECK_INTERVAL = 30  # Check every 30 seconds
PING_HOST = "8.8.8.8"  # Google DNS
LOG_FILE = os.environ.get(
    "PI_DISPLAY_LOG", "/opt/pi-smart-display/ops/logs/network-monitor.log"
)

# Setup logging
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)


class NetworkMonitor:
    def __init__(self):
        self.running = True
        self.consecutive_failures = 0
        self.max_failures = 3  # Restart network after 3 consecutive failures

        # Setup signal handler for graceful shutdown
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)

        logging.info(
            "Network monitor started - Checking connectivity every %d seconds",
            CHECK_INTERVAL,
        )
        logging.info(
            "Will restart network service after %d consecutive failures",
            self.max_failures,
        )

    def signal_handler(self, signum, frame):
        logging.info("Received signal %d, shutting down...", signum)
        self.running = False
        sys.exit(0)

    def check_connectivity(self):
        """Check if we can reach the internet"""
        try:
            # Ping with timeout of 5 seconds
            result = subprocess.run(
                ["ping", "-c", "1", "-W", "5", PING_HOST],
                capture_output=True,
                text=True,
                timeout=10,
            )
            return result.returncode == 0
        except (
            subprocess.TimeoutExpired,
            subprocess.CalledProcessError,
            FileNotFoundError,
        ):
            return False

    def restart_network_service(self):
        """Restart the network service"""
        try:
            logging.info("Restarting network service...")

            # Try systemctl first (preferred method)
            result = subprocess.run(
                ["sudo", "systemctl", "restart", "NetworkManager"],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 0:
                logging.info("Network service restarted successfully via systemctl")
                return True
            else:
                logging.warning("systemctl restart failed: %s", result.stderr)

                # Fallback to service command
                result = subprocess.run(
                    ["sudo", "service", "networking", "restart"],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )

                if result.returncode == 0:
                    logging.info(
                        "Network service restarted successfully via service command"
                    )
                    return True
                else:
                    logging.error("Both restart methods failed: %s", result.stderr)
                    return False

        except subprocess.TimeoutExpired:
            logging.error("Network service restart timed out")
            return False
        except Exception as e:
            logging.error("Error restarting network service: %s", e)
            return False

    def run(self):
        """Main monitoring loop"""
        try:
            while self.running:
                if self.check_connectivity():
                    if self.consecutive_failures > 0:
                        logging.info(
                            "Connectivity restored after %d failures",
                            self.consecutive_failures,
                        )
                    self.consecutive_failures = 0
                else:
                    self.consecutive_failures += 1
                    logging.warning(
                        "Connectivity check failed (%d/%d)",
                        self.consecutive_failures,
                        self.max_failures,
                    )

                    if self.consecutive_failures >= self.max_failures:
                        logging.error(
                            "Max failures reached, restarting network service..."
                        )
                        if self.restart_network_service():
                            self.consecutive_failures = 0
                            # Wait a bit longer after restart
                            time.sleep(60)
                        else:
                            logging.error("Failed to restart network service")
                            # Wait longer before trying again
                            time.sleep(120)

                time.sleep(CHECK_INTERVAL)

        except Exception as e:
            logging.error("Error in network monitor: %s", e)
        finally:
            logging.info("Network monitor stopped")


if __name__ == "__main__":
    monitor = NetworkMonitor()
    monitor.run()

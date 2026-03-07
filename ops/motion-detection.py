#!/usr/bin/env python3
import RPi.GPIO as GPIO
import time
import subprocess
import logging
import signal
import sys
import os

# Configuration
PIR_PIN = 17
TIMEOUT = 60  # 1 minute
OFF_HOUR = 23  # 11 PM
ON_HOUR = 7  # 7 AM
LOG_FILE = os.environ.get("PI_DISPLAY_LOG", "/opt/pi-smart-display/ops/logs/motion.log")

# Setup logging
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)


class MotionDetector:
    def __init__(self):
        self.motion_detected = False
        self.last_motion = time.time()
        self.monitor_on = True
        self.running = True

        # Setup GPIO
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(PIR_PIN, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)

        # Setup signal handler for graceful shutdown
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)

        logging.info("Motion detector started - Timeout: %d seconds", TIMEOUT)

        # Ensure monitor is on at startup if within active hours
        current_hour = time.localtime().tm_hour
        if not (current_hour >= OFF_HOUR or current_hour < ON_HOUR):
            self.turn_on_monitor()
        else:
            self.turn_off_monitor()

    def signal_handler(self, signum, frame):
        logging.info("Received signal %d, shutting down...", signum)
        self.running = False
        GPIO.cleanup()
        sys.exit(0)

    def turn_on_monitor(self):
        """Turn on the monitor using wlr-randr"""
        if not self.monitor_on:
            try:
                # Set display environment and use wlr-randr
                env = os.environ.copy()
                env["DISPLAY"] = ":0"
                env["XDG_RUNTIME_DIR"] = "/run/user/1000"

                result = subprocess.run(
                    ["wlr-randr", "--output", "HDMI-A-2", "--on"],
                    check=True,
                    capture_output=True,
                    text=True,
                    env=env,
                )
                logging.info(
                    "Monitor turned ON via wlr-randr: %s", result.stdout.strip()
                )
                self.monitor_on = True
            except (subprocess.CalledProcessError, FileNotFoundError) as e:
                logging.error("Failed to turn on monitor with wlr-randr: %s", e)
                # Fallback to vcgencmd
                try:
                    result = subprocess.run(
                        ["vcgencmd", "display_power", "1"],
                        check=True,
                        capture_output=True,
                        text=True,
                    )
                    logging.info(
                        "Monitor turned ON via vcgencmd: %s", result.stdout.strip()
                    )
                    self.monitor_on = True
                except subprocess.CalledProcessError as e2:
                    logging.error("Failed to turn on monitor with vcgencmd: %s", e2)

    def turn_off_monitor(self):
        """Turn off the monitor using wlr-randr"""
        if self.monitor_on:
            try:
                # Set display environment and use wlr-randr
                env = os.environ.copy()
                env["DISPLAY"] = ":0"
                env["XDG_RUNTIME_DIR"] = "/run/user/1000"

                result = subprocess.run(
                    ["wlr-randr", "--output", "HDMI-A-2", "--off"],
                    check=True,
                    capture_output=True,
                    text=True,
                    env=env,
                )
                logging.info(
                    "Monitor turned OFF via wlr-randr: %s", result.stdout.strip()
                )
                self.monitor_on = False
            except (subprocess.CalledProcessError, FileNotFoundError) as e:
                logging.error("Failed to turn off monitor with wlr-randr: %s", e)
                # Fallback to vcgencmd
                try:
                    result = subprocess.run(
                        ["vcgencmd", "display_power", "0"],
                        check=True,
                        capture_output=True,
                        text=True,
                    )
                    logging.info(
                        "Monitor turned OFF via vcgencmd: %s", result.stdout.strip()
                    )
                    self.monitor_on = False
                except subprocess.CalledProcessError as e2:
                    logging.error("Failed to turn off monitor with vcgencmd: %s", e2)

    def is_time_to_disable(self):
        """Check if current time is within the disable hours (11 PM to 7 AM)"""
        current_hour = time.localtime().tm_hour
        return current_hour >= OFF_HOUR or current_hour < ON_HOUR

    def run(self):
        """Main loop - simple polling instead of event detection"""
        try:
            while self.running:
                current_time = time.time()

                # Check if we're in the disable hours (11 PM to 7 AM)
                if self.is_time_to_disable():
                    if self.monitor_on:
                        logging.info("Disable hours active, turning off monitor")
                        self.turn_off_monitor()
                    time.sleep(60)  # Check every minute during disable hours
                    continue

                # Check for motion by polling GPIO
                motion_value = GPIO.input(PIR_PIN)
                if motion_value == 1:
                    if not self.motion_detected:
                        logging.info("Motion detected!")
                        self.motion_detected = True
                    self.last_motion = current_time
                    self.turn_on_monitor()
                else:
                    self.motion_detected = False

                # Check if timeout has passed
                if self.monitor_on and (current_time - self.last_motion) > TIMEOUT:
                    logging.info(
                        "Timeout reached (%d seconds), turning off monitor", TIMEOUT
                    )
                    self.turn_off_monitor()

                time.sleep(0.1)  # Check every 100ms

        except Exception as e:
            logging.error("Error in motion detector: %s", e)
        finally:
            GPIO.cleanup()


if __name__ == "__main__":
    detector = MotionDetector()
    detector.run()

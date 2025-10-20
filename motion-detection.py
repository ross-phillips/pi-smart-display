#!/usr/bin/env python3
"""
PIR Motion Detection for Smart Display
Turns on monitor when motion is detected, turns off after timeout
"""

import RPi.GPIO as GPIO
import subprocess
import time
import signal
import sys
import logging

# Configuration
PIR_PIN = 17  # GPIO pin connected to PIR sensor
TIMEOUT = 300  # Turn off monitor after 5 minutes of no motion (deactivateDelay)
OFF_HOUR = 23  # Turn off at 11 PM
ON_HOUR = 7    # Turn on at 7 AM
LOG_FILE = '/home/ross/pi-smart-display/motion.log'

# Setup logging
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

class MotionDetector:
    def __init__(self):
        self.motion_detected = False
        self.last_motion = time.time()
        self.monitor_on = False
        
    def setup_gpio(self):
        """Setup GPIO for PIR sensor"""
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(PIR_PIN, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)
        GPIO.add_event_detect(PIR_PIN, GPIO.RISING, callback=self.motion_callback)
        logging.info("PIR sensor setup complete on GPIO pin %d", PIR_PIN)
        
    def motion_callback(self, channel):
        """Called when motion is detected"""
        self.motion_detected = True
        self.last_motion = time.time()
        logging.info("Motion detected!")
        
    def turn_on_monitor(self):
        """Turn on the monitor"""
        if not self.monitor_on:
            try:
                # Try wlr-randr first (for Wayland), fallback to vcgencmd
                try:
                    subprocess.run(['wlr-randr', '--output', 'HDMI-A-2', '--on'], check=True)
                    logging.info("Monitor turned ON via wlr-randr")
                except (subprocess.CalledProcessError, FileNotFoundError):
                    subprocess.run(['vcgencmd', 'display_power', '1'], check=True)
                    logging.info("Monitor turned ON via vcgencmd")
                self.monitor_on = True
            except subprocess.CalledProcessError as e:
                logging.error("Failed to turn on monitor: %s", e)
                
    def turn_off_monitor(self):
        """Turn off the monitor"""
        if self.monitor_on:
            try:
                # Try wlr-randr first (for Wayland), fallback to vcgencmd
                try:
                    subprocess.run(['wlr-randr', '--output', 'HDMI-A-2', '--off'], check=True)
                    logging.info("Monitor turned OFF via wlr-randr")
                except (subprocess.CalledProcessError, FileNotFoundError):
                    subprocess.run(['vcgencmd', 'display_power', '0'], check=True)
                    logging.info("Monitor turned OFF via vcgencmd")
                self.monitor_on = False
            except subprocess.CalledProcessError as e:
                logging.error("Failed to turn off monitor: %s", e)
                
    def is_time_to_disable(self):
        """Check if current time is within the disable hours (11 PM to 7 AM)"""
        current_hour = time.localtime().tm_hour
        return current_hour >= OFF_HOUR or current_hour < ON_HOUR
    
    def run(self):
        """Main loop"""
        logging.info("Motion detector started")
        
        try:
            while True:
                current_time = time.time()
                
                # Check if we're in the disable hours (11 PM to 7 AM)
                if self.is_time_to_disable():
                    if self.monitor_on:
                        self.turn_off_monitor()
                    time.sleep(60)  # Check every minute during disable hours
                    continue
                
                # Check if motion was detected
                if self.motion_detected:
                    self.turn_on_monitor()
                    self.motion_detected = False
                
                # Check if timeout has passed
                if self.monitor_on and (current_time - self.last_motion) > TIMEOUT:
                    self.turn_off_monitor()
                
                time.sleep(1)  # Check every second
                
        except KeyboardInterrupt:
            logging.info("Motion detector stopped by user")
        except Exception as e:
            logging.error("Error in motion detector: %s", e)
        finally:
            GPIO.cleanup()
            logging.info("GPIO cleanup complete")

def signal_handler(sig, frame):
    """Handle shutdown signals"""
    logging.info("Received shutdown signal")
    sys.exit(0)

if __name__ == "__main__":
    # Setup signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    detector = MotionDetector()
    detector.setup_gpio()
    detector.run()

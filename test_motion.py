import RPi.GPIO as GPIO
import time

GPIO.setmode(GPIO.BCM)
GPIO.setup(17, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)

print("Testing PIR sensor - wave your hand in front of it...")
for i in range(20):
    value = GPIO.input(17)
    if value == 1:
        print(f"Motion detected! Value: {value}")
    else:
        print(f"No motion - Value: {value}")
    time.sleep(0.5)

GPIO.cleanup()

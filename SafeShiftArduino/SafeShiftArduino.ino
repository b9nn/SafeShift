/**
 * SafeShift Arduino Sketch — Nano 33 BLE Sense
 *
 * Reads all 5 sensors (temp, humidity, pressure, light, noise, vibration)
 * and outputs JSON to Serial in the format expected by the Express server.
 *
 * Output format matches POST /api/sensor-data:
 * { "deviceId", "companyId", "timestamp", "metrics": { temperature, humidity, airQuality, noise, lighting, pressure } }
 *
 * Connect via USB Serial, then run scripts/serial-bridge.js to forward to Express.
 */

#include <Arduino_HTS221.h>   // Temperature + Humidity
#include <Arduino_LPS22HB.h>  // Barometric pressure
#include <Arduino_APDS9960.h> // Ambient light
#include <Arduino_LSM9DS1.h>  // Accelerometer (vibration)
#include <PDM.h>              // Microphone (noise)

static const int MIC_BUF_SIZE = 256;
short micBuffer[MIC_BUF_SIZE];
volatile int micSamplesRead = 0;

void onPDMdata() {
  int bytesAvailable = PDM.available();
  int bytesToRead = min(bytesAvailable, (int)sizeof(micBuffer));
  PDM.read(micBuffer, bytesToRead);
  micSamplesRead = bytesToRead / 2;
}

float micRmsOnce() {
  if (micSamplesRead <= 0) return 0.0f;
  double sumSq = 0;
  for (int i = 0; i < micSamplesRead; i++) {
    double s = (double)micBuffer[i];
    sumSq += s * s;
  }
  double meanSq = sumSq / micSamplesRead;
  micSamplesRead = 0;
  return (float)sqrt(meanSq);
}

// Approximate dBA from RMS (calibration depends on environment)
float rmsToApproxDba(float rms) {
  if (rms < 1.0f) return 40.0f;
  // Rough mapping: RMS 100-5000 -> 50-90 dBA
  float logVal = log10(rms + 1.0f);
  return 45.0f + logVal * 25.0f;
}

void setup() {
  Serial.begin(115200);
  while (!Serial)
    ;

  bool ok = true;

  if (!HTS.begin()) {
    Serial.println("{\"err\":\"HTS221 init failed\"}");
    ok = false;
  }

  if (!BARO.begin()) {
    Serial.println("{\"err\":\"LPS22HB init failed\"}");
    ok = false;
  }

  if (!APDS.begin()) {
    Serial.println("{\"err\":\"APDS9960 init failed\"}");
    ok = false;
  }

  if (!IMU.begin()) {
    Serial.println("{\"err\":\"LSM9DS1 init failed\"}");
    ok = false;
  }

  PDM.onReceive(onPDMdata);
  if (!PDM.begin(1, 16000)) {
    Serial.println("{\"err\":\"PDM init failed\"}");
    ok = false;
  }

  if (ok) Serial.println("{\"status\":\"SafeShift sensors ready\"}");
}

void loop() {
  // Temperature (°C) and Humidity (%RH) — HTS221
  float tempC = 22.0f;
  float humidity = 45.0f;
  if (HTS.temperatureAvailable()) tempC = HTS.readTemperature();
  if (HTS.humidityAvailable()) humidity = HTS.readHumidity();

  // Pressure (hPa) — LPS22HB
  float pressureHpa = 1013.0f;
  if (BARO.pressureAvailable()) pressureHpa = BARO.readPressure();

  // Light (lux) — APDS9960: ambient/clear channel as proxy
  int cr = 0, cg = 0, cb = 0, cc = 0;
  float lightLux = 300.0f;
  if (APDS.colorAvailable()) {
    APDS.readColor(cr, cg, cb, cc);
    // Clear channel roughly correlates with illuminance; scale 0-65535 -> ~0-500 lux
    lightLux = (float)cc * 500.0f / 65535.0f;
    if (lightLux < 10.0f) lightLux = 10.0f;
  }

  // Vibration (m/s²) — LSM9DS1 accel magnitude
  float ax = 0, ay = 0, az = 0;
  float vibrationMs2 = 0.0f;
  if (IMU.accelerationAvailable()) {
    IMU.readAcceleration(ax, ay, az);
    vibrationMs2 = sqrt(ax * ax + ay * ay + az * az);
  }

  // Noise (dBA) — PDM mic RMS -> approximate dBA
  float micRms = micRmsOnce();
  float noiseDba = rmsToApproxDba(micRms);

  // Convert temp to °F for Express API
  float tempF = tempC * 9.0f / 5.0f + 32.0f;

  // Output JSON matching Express POST /api/sensor-data format
  Serial.print("{\"deviceId\":\"arduino-001\",\"companyId\":\"company-001\",\"timestamp\":");
  Serial.print(millis());
  Serial.print(",\"metrics\":{");
  Serial.print("\"temperature\":");
  Serial.print(tempF, 1);
  Serial.print(",\"humidity\":");
  Serial.print(humidity, 1);
  Serial.print(",\"airQuality\":850");  // No CO2 sensor — placeholder
  Serial.print(",\"noise\":");
  Serial.print(noiseDba, 1);
  Serial.print(",\"lighting\":");
  Serial.print(lightLux, 1);
  Serial.print(",\"pressure\":");
  Serial.print(pressureHpa, 1);
  Serial.print(",\"vibration\":");
  Serial.print(vibrationMs2, 3);
  Serial.println("}}");

  delay(2000);  // Send every 2 seconds
}

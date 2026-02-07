/**
 * Example Arduino Code for SafeShift
 * 
 * This shows how Arduino devices should send sensor data to the SafeShift server.
 * Adapt this code based on your specific sensors and Arduino board.
 */

#include <WiFi.h>  // For ESP32, use WiFi.h
// For Arduino with Ethernet shield, use Ethernet.h
// For other boards, use appropriate networking library

// WiFi credentials (or use Ethernet)
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// SafeShift server URL
const char* serverUrl = "http://your-server-ip:3001/api/sensor-data";

// Device and company identifiers
const String deviceId = "device-001";
const String companyId = "company-001";

// Sensor pins (adjust based on your setup)
const int tempPin = A0;
const int humidityPin = A1;
const int airQualityPin = A2;
const int noisePin = A3;
const int lightPin = A4;

void setup() {
  Serial.begin(9600);
  
  // Initialize WiFi (or Ethernet)
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("WiFi connected");
  
  // Initialize sensors
  // Add your sensor initialization code here
}

void loop() {
  // Read sensor values
  float temperature = readTemperature();      // °F
  float humidity = readHumidity();            // %RH
  int airQuality = readAirQuality();          // ppm CO2
  int noise = readNoise();                    // dBA
  int lighting = readLighting();              // lux
  float pressure = readPressure();            // kPa (optional)
  
  // Create JSON payload
  String jsonPayload = createJSONPayload(
    temperature, humidity, airQuality, noise, lighting, pressure
  );
  
  // Send to server
  sendToServer(jsonPayload);
  
  // Wait 1 second before next reading
  delay(1000);
}

float readTemperature() {
  // Implement your temperature sensor reading
  // Example: return analogRead(tempPin) * 0.1; // Adjust scaling
  return 72.5; // Placeholder
}

float readHumidity() {
  // Implement your humidity sensor reading
  return 45.0; // Placeholder
}

int readAirQuality() {
  // Implement your air quality sensor reading (CO2 ppm)
  return 850; // Placeholder
}

int readNoise() {
  // Implement your noise sensor reading (dBA)
  return 75; // Placeholder
}

int readLighting() {
  // Implement your light sensor reading (lux)
  return 350; // Placeholder
}

float readPressure() {
  // Implement your pressure sensor reading (kPa)
  // Optional - can return 0 if not available
  return 101.3; // Placeholder
}

String createJSONPayload(float temp, float hum, int air, int noise, int light, float pressure) {
  String json = "{";
  json += "\"deviceId\":\"" + deviceId + "\",";
  json += "\"companyId\":\"" + companyId + "\",";
  json += "\"timestamp\":" + String(millis()) + ",";
  json += "\"metrics\":{";
  json += "\"temperature\":" + String(temp) + ",";
  json += "\"humidity\":" + String(hum) + ",";
  json += "\"airQuality\":" + String(air) + ",";
  json += "\"noise\":" + String(noise) + ",";
  json += "\"lighting\":" + String(light);
  if (pressure > 0) {
    json += ",\"pressure\":" + String(pressure);
  }
  json += "}";
  json += "}";
  return json;
}

void sendToServer(String payload) {
  // Use HTTPClient for ESP32, or EthernetClient for Arduino with Ethernet
  // This is a simplified example - adapt to your board
  
  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  
  int httpResponseCode = http.POST(payload);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("Response: " + response);
    
    // Parse response to check if reward was sent
    // You can add logic here to display reward status on LCD, LED, etc.
  } else {
    Serial.println("Error sending data: " + String(httpResponseCode));
  }
  
  http.end();
}

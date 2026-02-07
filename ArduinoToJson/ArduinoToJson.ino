
#include <Arduino_LPS22HB.h>
#include <Arduino_APDS9960.h>
#include <Arduino_LSM9DS1.h>
#include <PDM.h>

//takes sound input and buffers to avoid overload
static const int MIC_BUF_SIZE = 256; // chunk size for mic input
short micBuffer[MIC_BUF_SIZE]; // buffer capacity 
volatile int micSamplesRead = 0; // 0 means no new sound

void onPDMdata() { //sensor triggers this function - runs every time mic has data
  int bytesAvailable = PDM.available(); //how many bytes of mic data
  int bytesToRead = min(bytesAvailable, (int)sizeof(micBuffer)); //only hold as much data as can read
  PDM.read(micBuffer, bytesToRead); // adds audio data to micBuffer
  micSamplesRead = bytesToRead / 2; // shorts - each short is 2 bytes
} //function copies audio into buffer and tells main program how many samples are ready

float micRmsOnce() { //sound levels - turns sound numbers into 1 loudness number
  if (micSamplesRead <= 0) return 0.0f;
  double sumSq = 0;
  for (int i = 0; i < micSamplesRead; i++) {
    double s = (double)micBuffer[i]; //takes one sound number (each air vibration measurement)
    sumSq += s * s;                  //squares it (to ensure positive values)
  }
  double meanSq = sumSq / micSamplesRead; //takes average
  micSamplesRead = 0; //resets
  return (float)sqrt(meanSq); //final sound level value in the interval
}


const char* gestureToString(int g) { //gesture detection - converts to a string rep. 
  switch (g) { 
    case GESTURE_UP: return "UP";
    case GESTURE_DOWN: return "DOWN";
    case GESTURE_LEFT: return "LEFT";
    case GESTURE_RIGHT: return "RIGHT";
#ifdef GESTURE_NEAR
    case GESTURE_NEAR: return "NEAR";
#endif
#ifdef GESTURE_FAR
    case GESTURE_FAR: return "FAR";
#endif
    default: return "NONE";
  }
}

void setup() { //runs on initial turning on
  Serial.begin(115200); //baud rate
  while (!Serial);

  bool ok = true; //set to false upon issue
  //failure messages
  if (!BARO.begin()) {
    Serial.println("{\"err\":\"LPS22HB init failed\"}");
    ok = false;
  }

  if (!APDS.begin()) {
    Serial.println("{\"err\":\"APDS9960 init failed\"}");
    ok = false;
  } else {
    // Optional: tune gesture sensitivity (0–100). You can remove this line.
    APDS.setGestureSensitivity(80);
  }

  if (!IMU.begin()) {
    Serial.println("{\"err\":\"LSM9DS1 init failed\"}");
    ok = false;
  }

  PDM.onReceive(onPDMdata); //run on PDM receiving of data (mic input)
  if (!PDM.begin(1, 16000)) { // mono, 16kHz
    Serial.println("{\"err\":\"PDM init failed\"}");
    ok = false;
  }

  if (ok) Serial.println("{\"status\":\"all sensors ready\"}");
}

void loop() {
  //pressure and temp
  float pressure_hPa = BARO.readPressure();
  float temp_c = BARO.readTemperature();

  //proximity
  int prox = APDS.readProximity();

  int r = -1, g = -1, b = -1, c = -1; //default colour values
  if (APDS.colorAvailable()) {
    //read colours
    APDS.readColor(r, g, b, c);
  }

  const char* gesture = "NONE";
  if (APDS.gestureAvailable()) {
    gesture = gestureToString(APDS.readGesture());
  }

  //accelerometer, gyroscope, magnetometer
  float ax=NAN, ay=NAN, az=NAN;
  float gx=NAN, gy=NAN, gz=NAN;
  float mx=NAN, my=NAN, mz=NAN;
  float mag_uT=NAN;

  if (IMU.accelerationAvailable()) IMU.readAcceleration(ax, ay, az);
  if (IMU.gyroscopeAvailable())    IMU.readGyroscope(gx, gy, gz);
  if (IMU.magneticFieldAvailable()) {
    IMU.readMagneticField(mx, my, mz);
    mag_uT = sqrt(mx*mx + my*my + mz*mz); //x, y, and z magnetic field strength
  }

  //mic loudness detector
  float mic_rms = micRmsOnce(); // small numeric feature, not raw audio

  // ---------- One JSON packet per timestep ----------
  Serial.print("{\"ts_ms\":");
  Serial.print(millis());

  Serial.print(",\"temp_c\":");
  Serial.print(temp_c, 2);

  Serial.print(",\"pressure_hPa\":");
  Serial.print(pressure_hPa, 2);

  Serial.print(",\"prox\":");
  Serial.print(prox);

  Serial.print(",\"gesture\":\"");
  Serial.print(gesture);
  Serial.print("\"");

  Serial.print(",\"color\":{");
  Serial.print("\"r\":"); Serial.print(r);
  Serial.print(",\"g\":"); Serial.print(g);
  Serial.print(",\"b\":"); Serial.print(b);
  Serial.print(",\"c\":"); Serial.print(c);
  Serial.print("}");

  Serial.print(",\"accel\":{");
  Serial.print("\"x\":"); Serial.print(ax, 3);
  Serial.print(",\"y\":"); Serial.print(ay, 3);
  Serial.print(",\"z\":"); Serial.print(az, 3);
  Serial.print("}");

  Serial.print(",\"gyro\":{");
  Serial.print("\"x\":"); Serial.print(gx, 3);
  Serial.print(",\"y\":"); Serial.print(gy, 3);
  Serial.print(",\"z\":"); Serial.print(gz, 3);
  Serial.print("}");

  Serial.print(",\"mag\":{");
  Serial.print("\"x\":"); Serial.print(mx, 3);
  Serial.print(",\"y\":"); Serial.print(my, 3);
  Serial.print(",\"z\":"); Serial.print(mz, 3);
  Serial.print(",\"mag_uT\":"); Serial.print(mag_uT, 3);
  Serial.print("}");

  Serial.print(",\"mic_rms\":");
  Serial.print(mic_rms, 1);

  Serial.println("}");

  delay(200); // 5 Hz; change to 1000 for 1 Hz if you want
}

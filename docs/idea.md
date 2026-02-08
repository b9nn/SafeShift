**Incentivized Monitoring of Factory Working Conditions**

We are proposing a system to deploy in factories especially in regions known for poor labour conditions. 

*what we do*
- measure env conditions
- use ml to detect anomoly conditions
- produce reports or suggestions
- rewards factories and thier workers when consistently safe results are achieved

*things we can measure*
- temp + humidity
- air quality
- noise level
- light level
- vibrations?

*ml application*
- detecting abnormal conditions (train on factory data) ❗ **the data is unlabeled so we need to define thresholds/labels DO NOT NEED TO BE PERFECT**
- generating overall scores and highlighting room for improvement
- input: multichanel sensor time series
- output: score, labour-risk index

*reward system (solana)*
- when factory is consistently good, bonuses are triggered
- certifications
- **insurance discounts** <----- ATTRACTIVE
- preferred discounts
- direct payments
- we can have some sort of rating db for all companies


*who funds?*
- governments (tax credits, subsidies)
- multinational brands (big companies want to be known for ethical environments REPUTATION)
- NGOs
- Industry leaders

*blackboard.io*
- governence + visualization interface
- presents scores and historical trends
- for audits

*presentation framework*
- workers sometimes cant report conditions safely
- factories "cleanup" before inspections (24 hour monitoring)
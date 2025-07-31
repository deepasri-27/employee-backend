  require('dotenv').config(); // <--- Required to read .env values
  const express = require('express');
  const axios = require('axios');
  const { parseStringPromise } = require('xml2js');
  const router = express.Router();
  const https = require('https');

  const agent = new https.Agent({ rejectUnauthorized: false }); // allow self-signed SSL
  const SAP_URL = `${process.env.SAP_PO_URL}ZSRV_EMP54_LOGINSERVICE?sap-client=${process.env.SAP_CLIENT}`;

  // POST /api/employee-login
  router.post('/employee-login', async (req, res) => {
    const { employeeId, password } = req.body;

    const soapEnvelope = ` 
     <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:urn="urn:sap-com:document:sap:rfc:functions">
   <soapenv:Header/>
   <soapenv:Body>
      <urn:ZHR_EMP54_LOGIN_FM>
         <EMPLOYEE_ID>${employeeId}</EMPLOYEE_ID>
         <PASSWORD>${password}</PASSWORD>
      </urn:ZHR_EMP54_LOGIN_FM>
   </soapenv:Body>
</soapenv:Envelope>

    `;

    try {
      const response = await axios.post(
        SAP_URL,
        soapEnvelope,
        {
          headers: {
            'Content-Type': 'text/xml;charset=UTF-8',
            'SOAPAction': process.env.SOAP_ACTION,
          },
          auth: {
            username: process.env.SAP_USERNAME,
            password: process.env.SAP_PASSWORD,
          },
          httpsAgent: agent,
        }
      );

      const json = await parseStringPromise(response.data);

      const envelope = json['soap-env:Envelope'];
      const body = envelope?.['soap-env:Body']?.[0];
      const result = body?.['n0:ZHR_EMP54_LOGIN_FMResponse']?.[0];
      const verification = result?.VERIFICATION?.[0];

      if (!verification) {
        return res.status(500).json({ error: 'VERIFICATION field missing in response' });
      }
   console.log(verification);
     res.json({ 
    status: verification, 
     employeeId: employeeId  // Return the same employeeId received in request
});

    } catch (error) {
      console.error('Login Error:', error.message);
      res.status(500).json({ error: 'SAP PI/PO Login Call Failed' });
    }
  });

  module.exports = router;

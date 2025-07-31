require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const https = require('https');
const router = express.Router();

// HTTPS agent to ignore self-signed certificate issues
const agent = new https.Agent({ rejectUnauthorized: false });

// SAP PI/PO WSDL endpoint for profile fetch
const SAP_PROFILE_URL = `${process.env.SAP_PO_URL}zsrv_emp54_profile?sap-client=${process.env.SAP_CLIENT}`;

router.post('/employee-profile', async (req, res) => {
  const { employeeId } = req.body;

  // SOAP XML Request Envelope
  const soapEnvelope = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:urn="urn:sap-com:document:sap:rfc:functions">
   <soapenv:Header/>
   <soapenv:Body>
      <urn:ZHR_EMP54_PROFILE_FM>
         <IV_PERNR>${employeeId}</IV_PERNR>
      </urn:ZHR_EMP54_PROFILE_FM>
   </soapenv:Body>
</soapenv:Envelope>
  `;
 console.log(soapEnvelope);
  try {
    const response = await axios.post(
      SAP_PROFILE_URL,
      soapEnvelope,
      {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': 'urn:sap-com:document:sap:rfc:functions:ZHR_EMP54_PROFILE_FM',
        },
        auth: {
          username: process.env.SAP_USERNAME,
          password: process.env.SAP_PASSWORD,
        },
        httpsAgent: agent,
      }
    );
  
    const xml = response.data;
    console.log("Raw SOAP Response:\n", xml);

    // Convert XML to JSON
    const json = await parseStringPromise(xml, { explicitArray: false });

    // Handle multiple namespace variants
    const envelope = json['soap-env:Envelope'] || json['soapenv:Envelope'] || json['SOAP-ENV:Envelope'];
    const body = envelope?.['soap-env:Body'] || envelope?.['soapenv:Body'] || envelope?.['SOAP-ENV:Body'];

    if (!body) {
      return res.status(500).json({ error: 'SOAP Body not found' });
    }

    // Find the correct response key
    const responseKey = Object.keys(body).find(key => key.includes('ZHR_EMP54_PROFILE_FMResponse'));
    const result = body[responseKey];

    if (!result) {
      return res.status(500).json({ error: 'SAP Response does not contain profile data' });
    }

    // Map the result to profile object
    const profile = {
      fullName: result.EV_FULLNAME || '',
      gender: result.EV_GENDER || '',
      dob: result.EV_DOB || '',
      orgUnit: result.EV_ORG_UNIT || '',
      position: result.EV_POSITION || '',
      department: result.EV_DEPARTMENT || '',
      compCode: result.EV_COMP_CODE || '',
      email: result.EV_EMAIL || '',
      phone: result.EV_PHONE || '',
      address: result.EV_ADDRESS || '',
    };
   console.log(profile);
    res.json(profile);

  } catch (error) {
    console.error('Profile Fetch Error:', error.message);
    res.status(500).json({ error: 'SAP PI/PO Profile Call Failed' });
  }
});

module.exports = router;

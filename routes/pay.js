require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const https = require('https');

const router = express.Router();

const agent = new https.Agent({ rejectUnauthorized: false });

// SAP PAY WSDL Endpoint
const SAP_PAY_URL = `${process.env.SAP_PO_URL}zsrv_emp54_payslip?sap-client=${process.env.SAP_CLIENT}`;

router.post('/employee-pay', async (req, res) => {
  const { employeeId } = req.body;

  const soapEnvelope = `4444
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:urn="urn:sap-com:document:sap:rfc:functions">
   <soapenv:Header/>
   <soapenv:Body>
      <urn:ZHR_EMP54_PAYSLIP_FM>
         <EMPLOYEE_ID>${employeeId}</EMPLOYEE_ID>
      </urn:ZHR_EMP54_PAYSLIP_FM>
   </soapenv:Body>
</soapenv:Envelope>
  `;

  try {
    const response = await axios.post(SAP_PAY_URL, soapEnvelope, {
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': 'urn:sap-com:document:sap:rfc:functions:ZHR_EMP54_PAYSLIP_FM',
      },
      auth: {
        username: process.env.SAP_USERNAME,
        password: process.env.SAP_PASSWORD,
      },
      httpsAgent: agent,
    });

    const xml = response.data;
    console.log('Raw SOAP Response:\n', xml);

    const json = await parseStringPromise(xml, { explicitArray: false });

    const envelope = json['soap-env:Envelope'] || json['soapenv:Envelope'] || json['SOAP-ENV:Envelope'];
    const body = envelope?.['soap-env:Body'] || envelope?.['soapenv:Body'] || envelope?.['SOAP-ENV:Body'];

    if (!body) {
      return res.status(500).json({ error: 'SOAP Body not found' });
    }

    const responseKey = Object.keys(body).find(key => key.includes('ZHR_EMP54_PAYSLIP_FMResponse'));
    const result = body[responseKey];

    if (!result || !result.PAYSLIP_DETAILS) {
      return res.status(404).json({ error: 'No payslip details found' });
    }

    const items = result.PAYSLIP_DETAILS.item;
    const payslipArray = Array.isArray(items) ? items : [items];

    const formattedPayslips = payslipArray.map(item => ({
      employeeId: item.EMP_ID || '',
      companyCode: item.COMPANY_CODE || '',
      costCenter: item.COST_CENTER || '',
      position: item.STELL || '',
      name: item.NAME || '',
      gender: item.GENDER || '',
      dateOfBirth: item.DOB || '',
      nationality: item.NATIONALITY || '',
      payScaleGroup: item.PS_GROUP || '',
      payScaleLevel: item.PS_LEVEL || '',
      amount: item.AMOUNT || '',
      wageType: item.WAGE_TYPE || '',
      currency: item.CURRENCY_KEY || '',
      workingHours: item.WORKING_HOURS || '',
    }));

    res.json({ payslip: formattedPayslips });

  } catch (error) {
    console.error('Payslip Fetch Error:', error.message);
    res.status(500).json({ error: 'SAP PI/PO Payslip Call Failed' });
  }
});

module.exports = router;

import axios from 'axios';
import * as cheerio from 'cheerio';
import FormData from 'form-data';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import fs from 'fs-extra';
import forge from 'node-forge';

// Configurar axios con soporte de cookies
const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

class SATService {
    constructor() {
        // URLs reales del portal del SAT
        this.baseURL = 'https://portalcfdi.facturaelectronica.sat.gob.mx';
        this.loginURL = 'https://cfdiau.sat.gob.mx/nidp/app/login';
        this.consultaURL = 'https://portalcfdi.facturaelectronica.sat.gob.mx/Consulta.aspx';
        this.session = null;
        this.cookies = new CookieJar();
        this.client = wrapper(axios.create({
            jar: this.cookies,
            timeout: 30000,
            maxRedirects: 5
        }));
    }

    /**
     * Autenticación con CIEC (RFC y contraseña)
     */
    async loginWithCIEC(rfc, password) {
        try {
            console.log(`Intentando login con CIEC para RFC: ${rfc}`);

            // Paso 1: Obtener la página de login
            const loginPageResponse = await this.client.get(`${this.loginURL}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8'
                }
            });

            const $ = cheerio.load(loginPageResponse.data);

            // Extraer tokens de seguridad (ASP.NET)
            const viewState = $('input[name="__VIEWSTATE"]').val() || '';
            const viewStateGenerator = $('input[name="__VIEWSTATEGENERATOR"]').val() || '';
            const eventValidation = $('input[name="__EVENTVALIDATION"]').val() || '';

            // Paso 2: Enviar credenciales
            const formData = new FormData();
            if (viewState) formData.append('__VIEWSTATE', viewState);
            if (viewStateGenerator) formData.append('__VIEWSTATEGENERATOR', viewStateGenerator);
            if (eventValidation) formData.append('__EVENTVALIDATION', eventValidation);

            // Campos del formulario de login del SAT
            formData.append('Ecom_User_ID', rfc.toUpperCase());
            formData.append('Ecom_Password', password);
            formData.append('submit', 'Enviar');

            const loginResponse = await this.client.post(`${this.loginURL}`, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': this.loginURL,
                    'Origin': 'https://cfdiau.sat.gob.mx'
                },
                maxRedirects: 5
            });

            // Verificar si el login fue exitoso
            // El SAT redirige o muestra ciertos elementos cuando es exitoso
            const responseText = typeof loginResponse.data === 'string' ? loginResponse.data : '';

            if (responseText.includes('Consulta') ||
                responseText.includes('Portal') ||
                responseText.includes('Servicios') ||
                responseText.includes('CFDI') ||
                loginResponse.status === 200 && !responseText.includes('incorrecta')) {

                this.session = {
                    rfc: rfc.toUpperCase(),
                    authenticated: true,
                    authMethod: 'ciec',
                    timestamp: new Date()
                };

                console.log(`✓ Login exitoso para RFC: ${rfc}`);
                return {
                    success: true,
                    message: 'Autenticación exitosa',
                    session: this.session
                };
            } else {
                throw new Error('Credenciales inválidas o error en el portal del SAT');
            }

        } catch (error) {
            console.error('Error en login CIEC:', error.message);
            return {
                success: false,
                error: `Error de autenticación: ${error.message}`
            };
        }
    }

    /**
     * Autenticación con e.firma (certificado y clave privada)
     */
    async loginWithEFirma(certificatePath, keyPath, password) {
        try {
            console.log('Intentando login con e.firma');

            // Leer archivos de certificado
            const cerBuffer = await fs.readFile(certificatePath);
            const keyBuffer = await fs.readFile(keyPath);

            // Parsear certificado (DER binario del SAT)
            let cert;
            try {
                // Primero intentar como DER binario (formato del SAT)
                const certDer = forge.util.createBuffer(cerBuffer);
                const certAsn1 = forge.asn1.fromDer(certDer);
                cert = forge.pki.certificateFromAsn1(certAsn1);
            } catch (e1) {
                try {
                    // Si falla, intentar como PEM
                    cert = forge.pki.certificateFromPem(cerBuffer.toString());
                } catch (e2) {
                    throw new Error('Formato de certificado no válido. Use archivo .cer del SAT');
                }
            }

            // Desencriptar llave privada (DER encriptado del SAT)
            let privateKey = null;
            let lastError = null;

            // Método 1: Intentar como DER binario encriptado (formato estándar del SAT)
            try {
                const keyDer = forge.util.createBuffer(keyBuffer);
                const keyAsn1 = forge.asn1.fromDer(keyDer);
                privateKey = forge.pki.decryptRsaPrivateKey(keyAsn1, password);
                if (privateKey) {
                    console.log('✓ Llave privada desencriptada (formato DER)');
                }
            } catch (e1) {
                lastError = e1;
            }

            // Método 2: Intentar como PEM encriptado
            if (!privateKey) {
                try {
                    const keyPem = keyBuffer.toString('utf8');
                    if (keyPem.includes('BEGIN ENCRYPTED PRIVATE KEY') || keyPem.includes('BEGIN RSA PRIVATE KEY')) {
                        privateKey = forge.pki.decryptRsaPrivateKey(keyPem, password);
                        if (privateKey) {
                            console.log('✓ Llave privada desencriptada (formato PEM)');
                        }
                    }
                } catch (e2) {
                    lastError = e2;
                }
            }

            // Método 3: Intentar convertir DER a PEM y luego desencriptar
            if (!privateKey) {
                try {
                    const keyDer = forge.util.createBuffer(keyBuffer);
                    const keyAsn1 = forge.asn1.fromDer(keyDer);

                    // Crear estructura PKCS#8 encriptada
                    const encryptedPrivateKeyInfo = forge.pki.wrapRsaPrivateKey(keyAsn1);
                    const pem = forge.pki.encryptedPrivateKeyToPem(encryptedPrivateKeyInfo);

                    privateKey = forge.pki.decryptRsaPrivateKey(pem, password);
                    if (privateKey) {
                        console.log('✓ Llave privada desencriptada (formato DER→PEM)');
                    }
                } catch (e3) {
                    lastError = e3;
                }
            }

            // Método 4: Intentar como PKCS#8 encriptado con desencriptación manual
            if (!privateKey) {
                try {
                    const keyDer = forge.util.createBuffer(keyBuffer);
                    const keyAsn1 = forge.asn1.fromDer(keyDer);

                    // Desencriptar PKCS#8 EncryptedPrivateKeyInfo
                    const encryptedPrivateKeyInfo = forge.pki.decryptPrivateKeyInfo(keyAsn1, password);
                    if (encryptedPrivateKeyInfo) {
                        privateKey = forge.pki.privateKeyFromAsn1(encryptedPrivateKeyInfo);
                        if (privateKey) {
                            console.log('✓ Llave privada desencriptada (formato PKCS#8 EncryptedPrivateKeyInfo)');
                        }
                    }
                } catch (e4) {
                    lastError = e4;
                }
            }

            // Método 5: Intentar leer como PrivateKeyInfo sin encriptar
            if (!privateKey) {
                try {
                    const keyDer = forge.util.createBuffer(keyBuffer);
                    const keyAsn1 = forge.asn1.fromDer(keyDer);

                    // Intentar como PrivateKeyInfo (PKCS#8 sin encriptar)
                    privateKey = forge.pki.privateKeyFromAsn1(keyAsn1);
                    if (privateKey) {
                        console.log('✓ Llave privada leída (formato PKCS#8)');
                    }
                } catch (e5) {
                    lastError = e5;
                }
            }

            if (!privateKey) {
                console.error('❌ Todos los métodos de desencriptación fallaron');
                console.error('Último error:', lastError?.message);
                throw new Error('Contraseña incorrecta o formato de llave no válido. Verifica que: (1) La contraseña sea correcta, (2) El archivo .key sea válido, (3) El archivo .key corresponda al certificado .cer');
            }

            // Extraer RFC del certificado
            // El RFC en los certificados del SAT está en el OID 2.5.4.45 (x500UniqueIdentifier)
            // o en algunos casos en el campo serialNumber del subject
            const subject = cert.subject.attributes;
            let rfc = null;

            // Primero buscar en x500UniqueIdentifier (OID 2.5.4.45)
            for (const attr of subject) {
                if (attr.type === '2.5.4.45' || attr.shortName === 'x500UniqueIdentifier') {
                    rfc = attr.value.replace(/\s/g, '').toUpperCase();
                    break;
                }
            }

            // Si no se encuentra, buscar en serialNumber (algunos certificados antiguos)
            if (!rfc) {
                for (const attr of subject) {
                    if (attr.shortName === 'serialNumber' || attr.name === 'serialNumber') {
                        // El serialNumber puede contener RFC/CURP separados por /
                        // Ejemplo: BCO240821BG5/CACG631117C92
                        let value = attr.value.replace(/\s/g, '').toUpperCase();

                        // Si contiene /, tomar solo la primera parte (RFC)
                        if (value.includes('/')) {
                            value = value.split('/')[0];
                        }

                        // Validar que tenga formato de RFC (12-13 caracteres alfanuméricos)
                        if (/^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{2,3}$/.test(value)) {
                            rfc = value;
                            break;
                        }
                    }
                }
            }

            // Si aún no se encuentra, intentar extraer del CN (Common Name)
            if (!rfc) {
                for (const attr of subject) {
                    if (attr.shortName === 'CN' || attr.name === 'commonName') {
                        const cn = attr.value;
                        // El CN a veces contiene el RFC entre paréntesis o al final
                        const rfcMatch = cn.match(/\b([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{2,3})\b/);
                        if (rfcMatch) {
                            rfc = rfcMatch[1].toUpperCase();
                            break;
                        }
                    }
                }
            }

            if (!rfc) {
                // Mostrar todos los atributos del certificado para debugging
                console.log('Atributos del certificado encontrados:');
                subject.forEach(attr => {
                    console.log(`  - ${attr.name || attr.shortName} (${attr.type}): ${attr.value}`);
                });
                throw new Error('No se pudo extraer el RFC del certificado. Verifique que sea un certificado válido de e.firma del SAT.');
            }

            console.log(`RFC extraído del certificado: ${rfc}`);

            // Obtener página de login con e.firma
            const loginPageResponse = await this.client.get(`${this.baseURL}/loginFiel.aspx`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            const $ = cheerio.load(loginPageResponse.data);
            const viewState = $('input[name="__VIEWSTATE"]').val();
            const viewStateGenerator = $('input[name="__VIEWSTATEGENERATOR"]').val();
            const eventValidation = $('input[name="__EVENTVALIDATION"]').val();

            // Crear firma digital
            const dataToSign = `${rfc}${new Date().toISOString()}`;
            const md = forge.md.sha256.create();
            md.update(dataToSign, 'utf8');
            const signature = privateKey.sign(md);
            const signatureB64 = forge.util.encode64(signature);

            // Enviar autenticación
            const formData = new FormData();
            formData.append('__VIEWSTATE', viewState);
            formData.append('__VIEWSTATEGENERATOR', viewStateGenerator);
            formData.append('__EVENTVALIDATION', eventValidation);
            formData.append('ctl00$MainContent$CertificateFile', cerBuffer, {
                filename: 'certificate.cer',
                contentType: 'application/x-x509-ca-cert'
            });
            formData.append('ctl00$MainContent$Signature', signatureB64);
            formData.append('ctl00$MainContent$LoginButton', 'Iniciar Sesión');

            const loginResponse = await this.client.post(`${this.baseURL}/loginFiel.aspx`, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                maxRedirects: 5
            });

            if (loginResponse.data.includes('Consulta') || loginResponse.data.includes('Portal')) {
                this.session = {
                    rfc,
                    authenticated: true,
                    authMethod: 'efirma',
                    timestamp: new Date()
                };

                console.log(`✓ Login exitoso con e.firma para RFC: ${rfc}`);
                return {
                    success: true,
                    message: 'Autenticación exitosa con e.firma',
                    session: this.session
                };
            } else {
                throw new Error('Error en autenticación con e.firma');
            }

        } catch (error) {
            console.error('Error en login e.firma:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Descargar facturas emitidas
     */
    async downloadEmitidas(rfc, fechaInicio, fechaFin, outputPath) {
        try {
            if (!this.session || !this.session.authenticated) {
                throw new Error('No hay sesión activa. Debe autenticarse primero.');
            }

            console.log(`Descargando facturas emitidas para ${rfc}`);
            console.log(`Período: ${fechaInicio} - ${fechaFin}`);

            // Obtener página de consulta
            const consultaResponse = await this.client.get(`${this.consultaURL}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });

            const $ = cheerio.load(consultaResponse.data);
            const viewState = $('input[name="__VIEWSTATE"]').val();
            const viewStateGenerator = $('input[name="__VIEWSTATEGENERATOR"]').val();
            const eventValidation = $('input[name="__EVENTVALIDATION"]').val();

            // Preparar formulario de búsqueda
            const formData = new FormData();
            formData.append('__VIEWSTATE', viewState);
            formData.append('__VIEWSTATEGENERATOR', viewStateGenerator);
            formData.append('__EVENTVALIDATION', eventValidation);
            formData.append('ctl00$MainContent$TipoConsulta', 'Emitidas');
            formData.append('ctl00$MainContent$FechaInicio', fechaInicio);
            formData.append('ctl00$MainContent$FechaFin', fechaFin);
            formData.append('ctl00$MainContent$BuscarButton', 'Buscar');

            // Realizar búsqueda
            const searchResponse = await this.client.post(`${this.consultaURL}`, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': this.consultaURL
                }
            });

            // Parsear resultados
            const $results = cheerio.load(searchResponse.data);
            const facturas = [];

            $results('table.GridView tr').each((i, elem) => {
                if (i === 0) return; // Skip header

                const $row = $results(elem);
                const uuid = $row.find('td').eq(0).text().trim();
                const fecha = $row.find('td').eq(1).text().trim();
                const emisor = $row.find('td').eq(2).text().trim();
                const receptor = $row.find('td').eq(3).text().trim();
                const total = $row.find('td').eq(4).text().trim();

                if (uuid) {
                    facturas.push({
                        uuid,
                        fecha,
                        emisor,
                        receptor,
                        total
                    });
                }
            });

            console.log(`✓ Encontradas ${facturas.length} facturas emitidas`);

            // Descargar XMLs
            await fs.ensureDir(outputPath);
            const descargados = [];

            for (const factura of facturas) {
                try {
                    const xmlResponse = await this.client.get(
                        `${this.baseURL}/DescargaXML.aspx?uuid=${factura.uuid}`,
                        {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            },
                            responseType: 'arraybuffer',
                            timeout: 15000
                        }
                    );

                    const filename = `${factura.uuid}.xml`;
                    const filepath = `${outputPath}/${filename}`;
                    await fs.writeFile(filepath, xmlResponse.data);

                    descargados.push({
                        ...factura,
                        filename,
                        filepath
                    });

                    console.log(`✓ Descargado: ${filename}`);
                } catch (error) {
                    console.error(`✗ Error descargando ${factura.uuid}:`, error.message);
                }
            }

            return {
                success: true,
                total: facturas.length,
                descargados: descargados.length,
                facturas: descargados
            };

        } catch (error) {
            console.error('Error en descarga de emitidas:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Descargar facturas recibidas
     */
    async downloadRecibidas(rfc, fechaInicio, fechaFin, outputPath) {
        try {
            if (!this.session || !this.session.authenticated) {
                throw new Error('No hay sesión activa. Debe autenticarse primero.');
            }

            console.log(`Descargando facturas recibidas para ${rfc}`);
            console.log(`Período: ${fechaInicio} - ${fechaFin}`);

            // Similar proceso que emitidas pero con tipo 'Recibidas'
            const consultaResponse = await this.client.get(`${this.consultaURL}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });

            const $ = cheerio.load(consultaResponse.data);
            const viewState = $('input[name="__VIEWSTATE"]').val();
            const viewStateGenerator = $('input[name="__VIEWSTATEGENERATOR"]').val();
            const eventValidation = $('input[name="__EVENTVALIDATION"]').val();

            const formData = new FormData();
            formData.append('__VIEWSTATE', viewState);
            formData.append('__VIEWSTATEGENERATOR', viewStateGenerator);
            formData.append('__EVENTVALIDATION', eventValidation);
            formData.append('ctl00$MainContent$TipoConsulta', 'Recibidas');
            formData.append('ctl00$MainContent$FechaInicio', fechaInicio);
            formData.append('ctl00$MainContent$FechaFin', fechaFin);
            formData.append('ctl00$MainContent$BuscarButton', 'Buscar');

            const searchResponse = await this.client.post(`${this.consultaURL}`, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': this.consultaURL
                }
            });

            const $results = cheerio.load(searchResponse.data);
            const facturas = [];

            $results('table.GridView tr').each((i, elem) => {
                if (i === 0) return;

                const $row = $results(elem);
                const uuid = $row.find('td').eq(0).text().trim();
                const fecha = $row.find('td').eq(1).text().trim();
                const emisor = $row.find('td').eq(2).text().trim();
                const receptor = $row.find('td').eq(3).text().trim();
                const total = $row.find('td').eq(4).text().trim();

                if (uuid) {
                    facturas.push({ uuid, fecha, emisor, receptor, total });
                }
            });

            console.log(`✓ Encontradas ${facturas.length} facturas recibidas`);

            // Descargar XMLs
            await fs.ensureDir(outputPath);
            const descargados = [];

            for (const factura of facturas) {
                try {
                    const xmlResponse = await this.client.get(
                        `${this.baseURL}/DescargaXML.aspx?uuid=${factura.uuid}`,
                        {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            },
                            responseType: 'arraybuffer',
                            timeout: 15000
                        }
                    );

                    const filename = `${factura.uuid}.xml`;
                    const filepath = `${outputPath}/${filename}`;
                    await fs.writeFile(filepath, xmlResponse.data);

                    descargados.push({
                        ...factura,
                        filename,
                        filepath
                    });

                    console.log(`✓ Descargado: ${filename}`);
                } catch (error) {
                    console.error(`✗ Error descargando ${factura.uuid}:`, error.message);
                }
            }

            return {
                success: true,
                total: facturas.length,
                descargados: descargados.length,
                facturas: descargados
            };

        } catch (error) {
            console.error('Error en descarga de recibidas:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Cerrar sesión
     */
    async logout() {
        try {
            if (this.session) {
                await this.client.get(`${this.baseURL}/logout.aspx`);
                this.session = null;
                this.cookies = new CookieJar();
                // Recrear cliente con nuevo jar
                this.client = wrapper(axios.create({
                    jar: this.cookies,
                    timeout: 30000,
                    maxRedirects: 5
                }));
                console.log('✓ Sesión cerrada');
            }
            return { success: true };
        } catch (error) {
            console.error('Error cerrando sesión:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verificar si hay sesión activa
     */
    isAuthenticated() {
        return this.session && this.session.authenticated;
    }

    /**
     * Obtener información de sesión
     */
    getSession() {
        return this.session;
    }
}

export default new SATService();

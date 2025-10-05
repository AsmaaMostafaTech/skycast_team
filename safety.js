// Safety Assistance Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Check for URL parameters to show specific alerts
    const urlParams = new URLSearchParams(window.location.search);
    const alertType = urlParams.get('alert');
    const alertMessage = urlParams.get('message');
    
    // Remove duplicate declarations at the bottom of the file
    const removeDuplicates = true; // This is just a marker for the removal below

    // Show specific alert if parameters exist
    if (alertType && alertMessage) {
        const alertBox = document.getElementById('weatherAlert');
        const alertDetails = document.getElementById('alertDetails');
        
        // Set alert message
        document.getElementById('alertMessage').textContent = decodeURIComponent(alertMessage);
        
        // Set alert type and icon
        let icon = '⚠️';
        switch(alertType) {
            case 'thunderstorm':
                icon = '⛈️';
                alertBox.classList.add('alert-danger');
                break;
            case 'extreme_heat':
                icon = '🥵';
                alertBox.classList.add('alert-warning');
                break;
            case 'heavy_rain':
                icon = '🌧️';
                alertBox.classList.add('alert-info');
                break;
            case 'strong_wind':
                icon = '💨';
                alertBox.classList.add('alert-warning');
                break;
        }
        
        // Update alert icon
        const iconElement = alertBox.querySelector('.fa-exclamation-triangle');
        if (iconElement) {
            iconElement.textContent = icon;
            iconElement.classList.remove('fa-exclamation-triangle');
        }
        
        // Auto-select the weather issue in the form
        if (document.getElementById('weatherIssue')) {
            document.getElementById('weatherIssue').value = alertType;
            updateRecommendations(alertType);
        }
    }
    // Global variables
    let map = null;
    let userMarker = null;
    let locationCircle = null;
    let searchControl = null;

    // Function to initialize the map
    function initMap() {
        // Check if map container exists and isn't already initialized
        const mapElement = document.getElementById('safetyMap');
        if (!mapElement || mapElement._leaflet_id) {
            return;
        }

        // Default coordinates (Riyadh)
        const defaultCoords = [24.7136, 46.6753];
        
        try {
            // Initialize the map
            map = L.map('safetyMap', {
                center: defaultCoords,
                zoom: 13,
                zoomControl: true,
                trackResize: true,
                preferCanvas: true
            });
            
            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19
            }).addTo(map);
            
            // Add click event to update location
            map.on('click', function(e) {
                updateMapLocation(e.latlng.lat, e.latlng.lng);
            });
            
            // Initialize search control - try different ways the plugin might be available
            const SearchControl = window.L.control.search || 
                               window.Control && window.Control.Search || 
                               window.L.Control && window.L.Control.Search;

            if (typeof SearchControl === 'function') {
                try {
                    searchControl = new SearchControl({
                        position: 'topleft',
                        placeholder: 'Search location...',
                        zoom: 12,
                        marker: false,
                        autoCollapse: true,
                        autoType: false,
                        minLength: 3,
                        provider: new window.GeoSearch.OpenStreetMapProvider(),
                        showMarker: false,
                        showPopup: false,
                        retainZoomLevel: false,
                        animateZoom: true,
                        searchLabel: 'Enter location',
                        keepResult: false
                    });

                    searchControl.on('search:locationfound', function(e) {
                        if (e.location && e.location.x && e.location.y) {
                            updateMapLocation(e.location.y, e.location.x);
                        } else if (e.latlng) {
                            updateMapLocation(e.latlng.lat, e.latlng.lng);
                        }
                    });

                    searchControl.on('search:collapsed', function() {
                        // Handle search collapse if needed
                    });

                    map.addControl(searchControl);
                    
                } catch (error) {
                    console.error('Error initializing search control:', error);
                }
            } else {
                console.warn('Leaflet Search plugin not found. The search functionality will be disabled.');
                // Add a simple search input as fallback
                const searchContainer = L.control({position: 'toplend'});
                searchContainer.onAdd = function() {
                    const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
                    div.innerHTML = `
                        <input type="text" id="locationSearch" 
                               placeholder="Search location..." 
                               style="width: 200px; padding: 5px; border: 2px solid #ccc; border-radius: 4px;">
                    `;
                    return div;
                };
                searchContainer.addTo(map);
                
                // Add event listener for the fallback search
                document.getElementById('locationSearch')?.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter' && this.value.trim()) {
                        const query = this.value.trim();
                        // Use OpenStreetMap Nominatim for geocoding
                        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
                            .then(response => response.json())
                            .then(data => {
                                if (data && data[0]) {
                                    const lat = parseFloat(data[0].lat);
                                    const lon = parseFloat(data[0].lon);
                                    updateMapLocation(lat, lon);
                                    map.setView([lat, lon], 13);
                                }
                            })
                            .catch(error => console.error('Error searching location:', error));
                    }
                });
            }
            
            // Get user's current location
            getUserLocation();
            
        } catch (error) {
            console.error('Error initializing map:', error);
        }
    }
    
    // Initialize the map when the page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMap);
    } else {
        initMap();
    }

    // Get user's current location with options for better accuracy
    function getUserLocation(highAccuracy = false) {
        if (!navigator.geolocation) {
            showLocationError('Geolocation is not supported by this browser');
            return;
        }

        const loadingAlert = document.createElement('div');
        loadingAlert.className = 'alert alert-info';
        loadingAlert.id = 'locationLoading';
        loadingAlert.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <i class="fas fa-sync fa-spin me-2"></i>
                    ${highAccuracy ? 'جاري تحديد موقعك بدقة عالية...' : 'جاري تحديد موقعك...'}
                </div>
                ${!highAccuracy ? `
                <button class="btn btn-sm btn-outline-primary" id="highAccuracyBtn">
                    <i class="fas fa-crosshairs me-1"></i>استخدام دقة عالية
                </button>
                ` : ''}
            </div>
        `;
        
        const mapContainer = document.getElementById('safetyMap').parentNode;
        const existingAlert = document.getElementById('locationLoading');
        if (existingAlert) {
            existingAlert.remove();
        }
        mapContainer.insertBefore(loadingAlert, document.getElementById('safetyMap'));

        // Add high accuracy button event listener
        if (!highAccuracy) {
            setTimeout(() => {
                const highAccuracyBtn = document.getElementById('highAccuracyBtn');
                if (highAccuracyBtn) {
                    highAccuracyBtn.addEventListener('click', () => {
                        loadingAlert.remove();
                        getUserLocation(true);
                    });
                }
            }, 100);
        }

        const options = {
            enableHighAccuracy: highAccuracy,
            timeout: highAccuracy ? 10000 : 5000,
            maximumAge: highAccuracy ? 0 : 30000
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                userLocation = { lat: latitude, lng: longitude };
                locationAccuracy = accuracy;
                
                // Show accuracy circle if accuracy is available
                if (window.accuracyCircle) {
                    map.removeLayer(window.accuracyCircle);
                }
                
                window.accuracyCircle = L.circle([latitude, longitude], {
                    radius: accuracy,
                    color: '#007bff',
                    fillColor: '#007bff',
                    fillOpacity: 0.1,
                    weight: 1
                }).addTo(map);
                
                updateMapLocation(latitude, longitude);
                getLocationName(latitude, longitude);
                loadingAlert.remove();
                
                // Show accuracy info
                showLocationAccuracy(accuracy);
            },
            (error) => {
                console.error('Error getting location:', error);
                loadingAlert.className = 'alert alert-warning';
                let errorMessage = 'تعذر تحديد موقعك. يرجى تحديده يدويًا على الخريطة.';
                
                switch(error.code) {
                    case error.PERMISSIONDenied:
                        errorMessage = 'تم رفض طلب الوصول إلى الموقع. يرجى تفعيل خدمات الموقع في إعدادات المتصفح.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'معلومات الموقع غير متوفرة حاليًا. يرجى المحاولة مرة أخرى لاحقًا.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'انتهت مهلة طلب الموقع. يرجى المحاولة مرة أخرى.';
                        break;
                }
                
                loadingAlert.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i>${errorMessage}`;
                updateMapLocation(24.7136, 46.6753); // Default to Riyadh coordinates
            },
            options
        );
    }
    
    // Show location accuracy information
    function showLocationAccuracy(accuracy) {
        const accuracyInfo = document.getElementById('locationAccuracy') || document.createElement('div');
        accuracyInfo.id = 'locationAccuracy';
        accuracyInfo.className = 'alert alert-info mt-2 py-1 small';
        accuracyInfo.innerHTML = `
            <i class="fas fa-info-circle me-1"></i>
            دقة الموقع: ${Math.round(accuracy)} متر
            <button class="btn btn-sm btn-link p-0 ms-2" id="improveAccuracyBtn">
                <i class="fas fa-crosshairs me-1"></i>تحسين الدقة
            </button>
        `;
        
        const locationContainer = document.getElementById('safetyMap').parentNode;
        const existingAccuracy = document.getElementById('locationAccuracy');
        if (existingAccuracy) {
            existingAccuracy.remove();
        }
        locationContainer.insertBefore(accuracyInfo, document.getElementById('safetyMap').nextSibling);
        
        // Add event listener for improve accuracy button
        document.getElementById('improveAccuracyBtn').addEventListener('click', () => {
            getUserLocation(true);
        });
    }
    
    // Show location error message
    function showLocationError(message) {
        const errorAlert = document.createElement('div');
        errorAlert.className = 'alert alert-warning';
        errorAlert.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i>${message}`;
        document.getElementById('safetyMap').parentNode.insertBefore(errorAlert, document.getElementById('safetyMap'));
    }
    
    // Add locate button
    const locateBtn = L.control({position: 'topleft'});
    locateBtn.onAdd = function() {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
        div.innerHTML = '<a href="#" title="تحديد موقعي" role="button" aria-label="تحديد موقعي"><i class="fas fa-location-arrow"></i></a>';
        div.onclick = function(e) {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
            getUserLocation();
            return false;
        };
        return div;
    };
    locateBtn.addTo(map);
    
    // Initial location detection
    getUserLocation();

    // Update map location and marker
    function updateMapLocation(lat, lng) {
        map.setView([lat, lng], 13);
        
        // Remove existing marker if it exists
        if (marker) {
            map.removeLayer(marker);
        }
        
        // Create custom icon
        const customIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style='background-color: #0d6efd; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; background: #0d6efd; position: absolute; transform: rotate(-45deg); left: 50%; top: 50%; margin: -15px 0 0 -15px;'></div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 30]
        });
        
        // Add draggable marker with custom icon
        marker = L.marker([lat, lng], {
            draggable: true,
            icon: customIcon
        }).addTo(map);

        // Update marker position on drag end
        marker.on('dragend', function() {
            const position = marker.getLatLng();
            userLocation = { lat: position.lat, lng: position.lng };
            getLocationName(position.lat, position.lng);
        });
        
        // Update user location if it's close to the new position
        if (userLocation) {
            const distance = Math.sqrt(
                Math.pow(userLocation.lat - lat, 2) + 
                Math.pow(userLocation.lng - lng, 2)
            ) * 111; // Convert degrees to kilometers
            
            if (distance < 1) { // Within 1km
                marker.setLatLng([userLocation.lat, userLocation.lng]);
            }
        }
    }

    // Get location name from coordinates with caching
    async function getLocationName(lat, lng) {
        const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
        
        // Check cache first
        if (locationCache.has(cacheKey)) {
            updateLocationUI(locationCache.get(cacheKey));
            return;
        }
        
        // Show loading state
        const locationElement = document.getElementById('locationName') || document.createElement('div');
        locationElement.id = 'locationName';
        locationElement.className = 'location-info';
        locationElement.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>جاري تحديد الموقع...';
        
        // Create or update location info container
        let locationContainer = document.getElementById('locationInfoContainer');
        if (!locationContainer) {
            locationContainer = document.createElement('div');
            locationContainer.id = 'locationInfoContainer';
            locationContainer.className = 'location-info-container mb-3 p-3 bg-light rounded';
            document.getElementById('safetyMap').parentNode.insertBefore(locationContainer, document.getElementById('safetyMap').nextSibling);
        }
        
        try {
            // Add rate limiting delay (Nominatim requires 1 second between requests)
            await new Promise(resolve => setTimeout(resolve, 1100));
            
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar&addressdetails=1`);
            const data = await response.json();
            
            let locationName = 'موقعك الحالي';
            const address = data.address || {};
            
            // Build hierarchical location name
            const locationParts = [
                address.road,
                address.quarter || address.suburb,
                address.city || address.town || address.village,
                address.county,
                address.state,
                address.country
            ].filter(Boolean);
            
            locationName = locationParts.length > 0 ? locationParts.join('، ') : 'موقعك الحالي';
            
            // Cache the result
            const locationData = {
                name: locationName,
                address: address,
                timestamp: new Date().toISOString()
            };
            locationCache.set(cacheKey, locationData);
            
            // Update UI with location details
            updateLocationUI(locationData);
            
        } catch (error) {
            console.error('Error getting location name:', error);
            locationElement.innerHTML = '<i class="fas fa-exclamation-triangle text-warning me-2"></i>تعذر تحميل اسم الموقع';
        }
    }
    
    // Update location information in the UI
    function updateLocationUI(locationData) {
        const { name, address } = locationData;
        const locationElement = document.getElementById('locationName') || document.createElement('div');
        locationElement.id = 'locationName';
        locationElement.className = 'location-info';
        
        // Create detailed location info
        let locationDetails = `
            <div class="location-details">
                <h6 class="mb-2"><i class="fas fa-map-marker-alt text-primary me-2"></i>${name}</h6>
        `;
        
        // Add address components if available
        if (address) {
            if (address.road) locationDetails += `<div class="text-muted small">${address.road}</div>`;
            if (address.quarter || address.suburb) {
                locationDetails += `<div class="text-muted small">${address.quarter || address.suburb}</div>`;
            }
            if (address.city || address.town || address.village) {
                locationDetails += `<div>${address.city || address.town || address.village}</div>`;
            }
        }
        
        locationDetails += '</div>';
        locationElement.innerHTML = locationDetails;
        
        // Update location info container
        const locationContainer = document.getElementById('locationInfoContainer');
        if (locationContainer) {
            locationContainer.innerHTML = '';
            locationContainer.appendChild(locationElement);
        }
    }

    // Toggle other issue input field and update recommendations
    const weatherIssueSelect = document.getElementById('weatherIssue');
    if (weatherIssueSelect) {
        // Remove any existing event listener to prevent duplicates
        const newWeatherIssueSelect = weatherIssueSelect.cloneNode(true);
        weatherIssueSelect.parentNode.replaceChild(newWeatherIssueSelect, weatherIssueSelect);
        
        newWeatherIssueSelect.addEventListener('change', function() {
            const otherIssueContainer = document.getElementById('otherIssueContainer');
            const selectedValue = this.value;
            
            if (otherIssueContainer) {
                otherIssueContainer.style.display = selectedValue === 'other' ? 'block' : 'none';
            }
            
            if (selectedValue !== 'other') {
                updateRecommendations(selectedValue);
                
                // Update alert message based on selection
                const alertBox = document.getElementById('weatherAlert');
                const alertMessage = document.getElementById('alertMessage');
                
                if (alertBox && alertMessage) {
                    const issueText = this.options[this.selectedIndex].text;
                    alertMessage.innerHTML = `تم الكشف عن: <strong>${issueText}</strong> في منطقتك. يرجى اتخاذ الاحتياطات اللازمة.`;
                    
                    // Update alert type
                    alertBox.className = 'alert alert-warning alert-box';
                    if (selectedValue === 'thunderstorm' || selectedValue === 'extreme_heat') {
                        alertBox.classList.add('alert-danger');
                    }
                }
            }
        });
    }

    // Handle form submission
    const submitButton = document.getElementById('submitHelpRequest');
    if (submitButton) {
        submitButton.addEventListener('click', function() {
            const issueSelect = document.getElementById('weatherIssue');
            const issue = issueSelect.value;
            const issueText = issueSelect.options[issueSelect.selectedIndex].text;
            const otherIssue = document.getElementById('otherIssue').value;
            const assistanceTypeSelect = document.getElementById('assistanceType');
            const assistanceType = assistanceTypeSelect.value;
            const assistanceText = assistanceTypeSelect.options[assistanceTypeSelect.selectedIndex].text;
            const description = document.getElementById('description').value;
            const isUrgent = document.getElementById('urgent').checked;
            const userName = document.getElementById('userName').value;
            const phoneNumber = document.getElementById('phoneNumber').value;
            
            // Validate required fields
            if (!issue) {
                showAlert('الرجاء تحديد نوع الحالة الجوية', 'danger');
                return;
            }
            
            if (issue === 'other' && !otherIssue.trim()) {
                showAlert('الرجاء تحديد الحالة الجوية', 'danger');
                return;
            }
            
            const position = marker.getLatLng();
            
            // Prepare request data
            const requestData = {
                user: {
                    name: userName,
                    phone: phoneNumber
                },
                location: {
                    lat: position.lat,
                    lng: position.lng,
                    name: document.querySelector('#locationName')?.textContent || 'موقع غير معروف'
                },
                issue: {
                    type: issue,
                    description: issue === 'other' ? otherIssue : issueText
                },
                assistance: {
                    type: assistanceType,
                    description: assistanceText
                },
                details: description,
                isUrgent: isUrgent,
                timestamp: new Date().toISOString(),
                status: 'new'
            };
            
            // Show loading state
            const spinner = document.getElementById('submitSpinner');
            const originalButtonText = submitButton.innerHTML;
            submitButton.disabled = true;
            spinner.classList.remove('d-none');
            
            // Simulate API call (replace with actual API call)
            setTimeout(() => {
                console.log('Help request submitted:', requestData);
                
                // Show success message
                document.getElementById('successAlert').classList.remove('d-none');
                
                // Reset form
                document.getElementById('weatherForm').reset();
                
                // Hide success message after 5 seconds
                setTimeout(() => {
                    document.getElementById('successAlert').classList.add('d-none');
                }, 5000);
                
                // Reset button state
                submitButton.disabled = false;
                spinner.classList.add('d-none');
                
                // Notify emergency services if urgent
                if (isUrgent) {
                    notifyEmergencyServices(requestData);
                }
                
            }, 1500);
        });
    }
    
    // Function to show alert message
    function showAlert(message, type = 'info') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show mt-3`;
        alertDiv.role = 'alert';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        const form = document.querySelector('.card-body');
        form.insertBefore(alertDiv, form.firstChild);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            alertDiv.classList.remove('show');
            setTimeout(() => alertDiv.remove(), 150);
        }, 5000);
    }
    
    // Function to notify emergency services (simulated)
    function notifyEmergencyServices(requestData) {
        console.log('Notifying emergency services:', requestData);
        // In a real app, this would be an API call to your backend
        // which would then notify the appropriate emergency services
    }

    // Update safety recommendations based on weather issue
    function updateRecommendations(weatherIssue) {
        const recommendationsContainer = document.getElementById('safetyRecommendations');
        if (!recommendationsContainer) return;
        
        let recommendations = [];
        let icon = '⚠️';
        let title = 'نصائح أمان عامة';
        
        // Define recommendations for each weather condition in Arabic
        switch(weatherIssue) {
            case 'heavy_rain':
                icon = '🌧️';
                title = 'نصائح للأمطار الغزيرة والفيضانات';
                recommendations = [
                    'الانتقال إلى أرض مرتفعة إذا كنت في منطقة معرضة للفيضانات.',
                    'تجنب السير أو القيادة في مياه الفيضانات.',
                    'ابتعد عن خطوط الكهرباء المتساقطة.',
                    'احتفظ بحقيبة طوارئ تحتوي على طعام وماء وأدوية.',
                    'تأكد من نظافة مجاري المياه حول منزلك.',
                    'لا تحاول عبور الجسور المغمورة بالمياه.'
                ];
                break;
                
            case 'thunderstorm':
                icon = '⚡';
                title = 'نصائح للعواصف الرعدية والبرق';
                recommendations = [
                    'ابقَ في الداخل وابتعد عن النوافذ.',
                    'تجنب استخدام الأجهزة الكهربائية والسباكة.',
                    'إذا كنت بالخارج، ابحث عن منطقة منخفضة بعيدًا عن الأشجار والأجسام المعدنية.',
                    'انتظر 30 دقيقة على الأقل بعد آخر رعدة قبل الخروج.',
                    'افصل الأجهزة الكهربائية الحساسة.',
                    'لا تستخدم الهاتف الأرضي أثناء العاصفة.'
                ];
                break;
                
            case 'extreme_heat':
                icon = '🥵';
                title = 'نصائح لموجات الحر الشديدة';
                recommendations = [
                    'ابقَ في الأماكن المكيفة قدر الإمكان.',
                    'اشرب الكثير من الماء وتجنب المشروبات التي تحتوي على الكافيين أو الكحول.',
                    'ارتدِ ملابس خفيفة وفضفاضة وذات ألوان فاتحة.',
                    'افحص على كبار السن والأطفال والحيوانات الأليفة.',
                    'تجنب التعرض المباشر لأشعة الشمس في ساعات الذروة.',
                    'استخدم واقي الشمس عند الخروج.'
                ];
                break;
                
            case 'extreme_cold':
                icon = '🥶';
                title = 'نصائح لموجات البرد الشديد';
                recommendations = [
                    'ارتدي طبقات متعددة من الملابس الدافئة.',
                    'تأكد من تدفئة المنزل بشكل جيد.',
                    'افحص على الجيران وكبار السن.',
                    'احرص على تدفئة الأنابيب لمنع تجمدها.',
                    'تجنب الخروج إلا للضرورة القصوى.',
                    'احرص على تغطية الرأس والأذنين واليدين عند الخروج.'
                ];
                break;
                
            case 'strong_wind':
                icon = '💨';
                title = 'نصائح للرياح القوية والعواصف';
                recommendations = [
                    'ابقَ في الداخل وابتعد عن النوافذ والأبواب الخارجية.',
                    'أحكم تثبيت الأشياء الخارجية التي قد تطير بفعل الرياح.',
                    'كن حذرًا من الحطام المتطاير.',
                    'إذا كنت تقود، كن حذرًا من الأغصان المتساقطة وخطوط الكهرباء.',
                    'تجنب الوقوف تحت الأشجار أو المباني العالية.',
                    'أغلق النوافذ والأبواب الخارجية بإحكام.'
                ];
                break;
                
            case 'sandstorm':
                icon = '🌪️';
                title = 'نصائح للعواصف الرملية';
                recommendations = [
                    'اغلق النوافذ والأبواب بإحكام.',
                    'استخدم الكمامات أو مناديل مبللة لحماية أنفك وفمك.',
                    'إذا كنت بالخارج، ابحث عن مأوى فورًا.',
                    'تجنب القيادة أثناء العاصفة الرملية.',
                    'احمِ عينيك بالنظارات الواقية.',
                    'اغسل وجهك ويديك جيدًا بعد انتهاء العاصفة.'
                ];
                break;
                
            case 'fog':
                icon = '🌫️';
                title = 'نصائح للضباب الكثيف';
                recommendations = [
                    'خفف السرعة واستخدم الأضواء المنخفضة أثناء القيادة.',
                    'حافظ على مسافة أمان أكبر بينك وبين السيارة التي أمامك.',
                    'استخدم إشارات الطوارئ إذا توقفت على جانب الطريق.',
                    'تجنب تغيير المسارات بشكل مفاجئ.',
                    'إذا كان الضباب كثيفًا جدًا، ابحث عن مكان آمن وانتظر حتى يتحسن الطقس.',
                    'استمع إلى تحديثات الطرق والمرور.'
                ];
                break;
                
            default:
                icon = 'ℹ️';
                title = 'نصائح أمان عامة';
                recommendations = [
                    'تابع تحديثات الطقس المحلية والتحذيرات الرسمية.',
                    'اتبع تعليمات الدفاع المدني والجهات المختصة.',
                    'احرص على وجود حقيبة طوارئ تحتوي على مستلزمات أساسية.',
                    'تأكد من معرفة طرق الإخلاء في منطقتك.',
                    'احتفظ بأرقام الطوارئ في متناول اليد.',
                    'خطط مسبقًا لكيفية التواصل مع عائلتك في حالات الطوارئ.'
                ];
        }

        // Create recommendation HTML with RTL support
        let recommendationsHTML = `
            <div class="alert alert-info">
                <h5 class="mb-3"><span class="fs-4">${icon}</span> ${title}</h5>
                <div class="recommendations-list">
        `;
        
        recommendations.forEach(rec => {
            recommendationsHTML += `
                <div class="recommendation-card p-3 bg-light mb-2 rounded">
                    <p class="mb-0">
                        <i class="fas fa-check-circle text-success ms-2"></i>
                        ${rec}
                    </p>
                </div>
            `;
        });
        
        // Add emergency contacts section
        recommendationsHTML += `
            </div>
            <div class="emergency-contacts mt-4">
                <h6 class="border-bottom pb-2 mb-3"><i class="fas fa-phone-volume me-2"></i>أرقام الطوارئ</h6>
                <div class="row g-2">
                    <div class="col-6">
                        <a href="tel:911" class="btn btn-outline-danger w-100 text-start">
                            <i class="fas fa-phone-alt me-2"></i>الطوارئ
                            <span class="float-start">911</span>
                        </a>
                    </div>
                    <div class="col-6">
                        <a href="tel:997" class="btn btn-outline-danger w-100 text-start">
                            <i class="fas fa-ambulance me-2"></i>الإسعاف
                            <span class="float-start">997</span>
                        </a>
                    </div>
                    <div class="col-6">
                        <a href="tel:998" class="btn btn-outline-danger w-100 text-start">
                            <i class="fas fa-fire-extinguisher me-2"></i>الدفاع المدني
                            <span class="float-start">998</span>
                        </a>
                    </div>
                    <div class="col-6">
                        <a href="tel:999" class="btn btn-outline-danger w-100 text-start">
                            <i class="fas fa-shield-alt me-2"></i>الشرطة
                            <span class="float-start">999</span>
                        </a>
                    </div>
                </div>
            </div>
        `;
        
        // Add nearby places section if relevant
        if (['extreme_heat', 'heavy_rain', 'thunderstorm'].includes(weatherIssue)) {
            const placeType = weatherIssue === 'extreme_heat' ? 'مراكز التبريد' : 'الملاجئ القريبة';
            recommendationsHTML += `
                <div class="nearby-places mt-4">
                    <h6 class="border-bottom pb-2 mb-3">
                        <i class="fas fa-map-marker-alt me-2"></i>${placeType}
                    </h6>
                    <div id="nearbyPlacesList" class="list-group">
                        <div class="list-group-item">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="mb-1">مركز الإغاثة المحلي</h6>
                                    <small class="text-muted">على بعد 1.2 كم</small>
                                </div>
                                <a href="#" class="btn btn-sm btn-outline-primary">عرض الخريطة</a>
                            </div>
                        </div>
                        <div class="list-group-item">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="mb-1">${weatherIssue === 'extreme_heat' ? 'مركز تسوق مكيف' : 'مأوى الطوارئ'}</h6>
                                    <small class="text-muted">عند بعد 2.3 كم</small>
                                </div>
                                <a href="#" class="btn btn-sm btn-outline-primary">عرض الخريطة</a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        recommendationsHTML += '</div>'; // Close alert div
        
        // Add some CSS for the recommendations
        const style = document.createElement('style');
        style.textContent = `
            .recommendations-list {
                max-height: 400px;
                overflow-y: auto;
                padding: 10px;
            }
            .recommendation-card {
                transition: all 0.3s ease;
                border-right: 4px solid #0d6efd;
                border-radius: 4px;
                margin-bottom: 10px;
            }
            .recommendation-card:hover {
                transform: translateX(-5px);
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .emergency-contacts .btn {
                text-align: right;
                direction: rtl;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .emergency-contacts .btn i {
                margin-left: 8px;
            }
        `;
        
        // Clear previous styles and update content
        document.querySelectorAll('style').forEach(el => el.remove());
        document.head.appendChild(style);
        
        // Update the recommendations container with fade effect
        recommendationsContainer.style.opacity = '0';
        setTimeout(() => {
            recommendationsContainer.innerHTML = recommendationsHTML;
            recommendationsContainer.style.opacity = '1';
            
            // Initialize tooltips
            const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.map(function (tooltipTriggerEl) {
                return new bootstrap.Tooltip(tooltipTriggerEl);
            });
        }, 300);
    }

    // Initialize with default recommendations
    // Use the existing urlParams and alertType from above
    if (alertType) {
        updateRecommendations(alertType);
        // Set the weather issue select value if it exists
        const weatherSelect = document.getElementById('weatherIssue');
        if (weatherSelect) {
            weatherSelect.value = alertType;
        }
    } else {
        // Default to showing general safety information
        updateRecommendations('general');
    }
    
    // Add click handler for emergency buttons
    document.querySelectorAll('.emergency-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const number = this.getAttribute('data-number');
            if (confirm(`هل تريد الاتصال بالرقم ${number}؟`)) {
                window.location.href = `tel:${number}`;
            }
        });
    });
    
    // Function to check weather for a specific location
    async function checkWeatherForLocation(locationName) {
        try {
            // Show loading state
            const alertBox = document.getElementById('weatherAlert');
            alertBox.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="spinner-border me-2" role="status">
                        <span class="visually-hidden">جارٍ التحميل...</span>
                    </div>
                    <strong>جاري التحقق من حالة الطقس في ${locationName}...</strong>
                </div>
            `;
            alertBox.classList.remove('d-none', 'alert-danger', 'alert-warning', 'alert-info');
            alertBox.classList.add('alert-info');

            // Simulate API call (in a real app, you would call a weather API here)
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Example weather conditions for demonstration
            const locations = {
                'جبل شمس': { type: 'snow', message: 'تحذير: درجات الحرارة تحت الصفر مع فرصة لتساقط الثلوج' },
                'الرياض': { type: 'extreme_heat', message: 'تحذير: موجة حر شديدة - تجنب التعرض المباشر للشمس' },
                'جدة': { type: 'heavy_rain', message: 'تحذير: أمطار غزيرة متوقعة مع رياح قوية' },
                'الدمام': { type: 'dust', message: 'تحذير: عاصفة ترابية - يُنصح بعدم الخروج' },
                'عسير': { type: 'fog', message: 'تحذير: ضباب كثيف - انخفاض في مدى الرؤية' }
            };

            const weatherInfo = locations[locationName] || {
                type: 'info',
                message: 'لا توجد تحذيرات جوية حالياً في هذه المنطقة'
            };

            // Show the weather alert
            showWeatherAlert(weatherInfo.type, weatherInfo.message);

        } catch (error) {
            console.error('Error checking weather:', error);
            showWeatherAlert('error', 'حدث خطأ أثناء جلب بيانات الطقس');
        }
    }

    // Function to show weather alert
    function showWeatherAlert(type, message) {
        const alertBox = document.getElementById('weatherAlert');
        const alertDetails = document.getElementById('alertDetails');
        
        let icon = 'ℹ️';
        alertBox.className = 'alert d-flex align-items-center';
        
        switch(type) {
            case 'snow':
                icon = '❄️';
                alertBox.classList.add('alert-info');
                break;
            case 'extreme_heat':
                icon = '🥵';
                alertBox.classList.add('alert-warning');
                break;
            case 'heavy_rain':
                icon = '🌧️';
                alertBox.classList.add('alert-danger');
                break;
            case 'dust':
                icon = '💨';
                alertBox.classList.add('alert-warning');
                break;
            case 'fog':
                icon = '🌫️';
                alertBox.classList.add('alert-info');
                break;
            default:
                alertBox.classList.add('alert-secondary');
        }
        
        alertBox.innerHTML = `
            ${icon} <strong>${message}</strong>
            <button type="button" class="btn-close me-auto" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        alertBox.classList.remove('d-none');
    }

    // Add click handlers for example locations
    document.querySelectorAll('.example-location').forEach(button => {
        button.addEventListener('click', () => {
            const location = button.getAttribute('data-location');
            checkWeatherForLocation(location);
        });
    });

    // Initialize form validation
    const form = document.getElementById('safetyForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const locationInput = document.getElementById('locationInput');
            if (locationInput && locationInput.value.trim()) {
                checkWeatherForLocation(locationInput.value.trim());
            }
        });
    }

    // Close the DOMContentLoaded event listener
});

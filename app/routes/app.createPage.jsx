import {
  Box,
  Card,
  Layout,
  Link,
  Page,
  Text,
  BlockStack,
  TextField,
  Button,
  Banner,
  InlineStack,
  Icon,
  Select,
  Checkbox,
  List,
  Thumbnail,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState, useCallback, useEffect } from "react";
import { useLoaderData, useActionData, useSubmit, Form } from "react-router-dom";
import { authenticate } from "../shopify.server.js";
import { DeleteIcon,  SearchIcon } from "@shopify/polaris-icons";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  
  // Fetch store products
  const response = await admin.graphql(
    `#graphql
      query {
        products(first: 50) {
          edges {
            node {
              id
              title
              description
              featuredImage {
                url
                altText
              }
              variants(first: 10) {
                edges {
                  node {
                    id
                    price
                    compareAtPrice
                    sku
                    inventoryQuantity
                  }
                }
              }
            }
          }
        }
      }`
  );
  
  const responseJson = await response.json();
  const products = responseJson.data.products.edges.map(edge => ({
    id: edge.node.id,
    title: edge.node.title,
    description: edge.node.description || '',
    featuredImage: edge.node.featuredImage?.url || 'https://via.placeholder.com/200x250?text=No+Image',
    variants: edge.node.variants.edges.map(variantEdge => variantEdge.node)
  }));

  return { products, session };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const pageTitle = formData.get("title");
  const pageBody = formData.get("body");

   const fullPage = `
    <div>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          background: #fefefe;
        }
        .step-indicator {
          text-align: center;
          font-weight: bold;
          margin-bottom: 20px;
          font-size: 20px;
          color: #e91e63;
        }
        .product-list {
          display: flex;
          justify-content: space-around;
          flex-wrap: wrap;
          margin: 20px 0;
        }
        .card {
          border: 1px solid #ccc;
          width: 200px;
          padding: 10px;
          margin: 10px;
          text-align: center;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .card img {
          width: 100%;
          height: 150px;
          object-fit: cover;
          border-radius: 5px;
          margin-bottom: 10px;
        }
        .card h4 {
          margin: 10px 0 5px 0;
          font-size: 16px;
          color: #333;
        }
        .card p {
          margin: 5px 0;
          color: #666;
          font-size: 14px;
        }
        .quantity-controls {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          margin: 10px 0;
        }
        .quantity-controls button {
          padding: 5px 10px;
          border: 1px solid #ddd;
          background: #f5f5f5;
          cursor: pointer;
          border-radius: 4px;
        }
        .quantity-controls button:hover {
          background: #e91e63;
          color: white;
        }
        .quantity-display {
          font-weight: bold;
          min-width: 30px;
          text-align: center;
        }
        .sold-out {
          color: red;
          font-weight: bold;
        }
        .selection-summary {
          margin-top: 30px;
          padding: 20px;
          border-top: 1px solid #ccc;
          text-align: center;
          background: #f9f9f9;
          border-radius: 8px;
        }
        #selectedItems {
          display: flex;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
          margin: 15px 0;
        }
        .selected-item {
          background: white;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }
        .selected-item button {
          background: #ff4444;
          color: white;
          border: none;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .selected-item button:hover {
          background: #cc0000;
        }
        #nextBtn, #backBtn {
          padding: 12px 24px;
          background: #e91e63;
          color: #fff;
          border: none;
          cursor: pointer;
          margin: 10px;
          border-radius: 6px;
          font-size: 16px;
          transition: background 0.3s;
        }
        #nextBtn:hover, #backBtn:hover {
          background: #c2185b;
        }
        #nextBtn:disabled, #backBtn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        input, textarea {
          width: 100%;
          padding: 10px;
          margin-top: 5px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }
        label {
          font-weight: bold;
          color: #333;
        }
        .form-field {
          margin-bottom: 20px;
        }
        .form-container {
          max-width: 400px;
          margin: 0 auto;
        }
        #AddToCartBtn {
          padding: 12px 24px;
          background: #3052e9;
          color: #fff;
          border: none;
          cursor: pointer;
          margin: 10px;
          border-radius: 6px;
          font-size: 16px;
          transition: background 0.3s;
        }
        #AddToCartBtn:hover {
          background: #2540c4;
        }
        .price-section {
          font-size: 18px;
          margin: 10px 0;
        }
        .discount-section {
          background: #e8f5e8;
          padding: 15px;
          border-radius: 8px;
          margin: 15px 0;
        }
        .loading {
          opacity: 0.7;
          pointer-events: none;
        }
        .error-message {
          color: #ff4444;
          background: #ffe6e6;
          padding: 10px;
          border-radius: 4px;
          margin: 10px 0;
        }
        .success-message {
          color: #00a000;
          background: #e6ffe6;
          padding: 10px;
          border-radius: 4px;
          margin: 10px 0;
        }
      </style>
      <div class="step-indicator" id="stepTitle"></div>
      <div id="stepContainer"></div>
      <div class="selection-summary">
        <h3>Selected Items</h3>
        <div id="selectedItems"></div>
        <div class="price-section">
          <p>Sub Total: $ <span id="totalPrice">0.00</span></p>
          <p> Discount : <strong id="descountApply"> 0 </strong>%</p>
          <p>Total after discount: $ <strong id="afterDescountTotelPrice">0.00</strong></p>
        </div>
        <div id="messageContainer"></div>
        <div>
          <button id="backBtn" onclick="goBack()">← Back</button>
          <button id="nextBtn" onclick="goNext()">Next →</button>
          <button id="AddToCartBtn" onclick="addToCart()">Add to Cart</button>
        </div>
        <div id="descountSection" class="discount-section"></div>
      </div>

      <script type="text/javascript" async>
        const steps = ${pageBody};
        const descountType = "Total Quantity";
        const descountArry = [
          { min: 1, dsp: 5 },
          { min: 3, dsp: 15 },
          { min: 5, dsp: 25 },
          { min: 7, dsp: 30 }
        ];

        let currentStep = 0;
        let selectedItems = [];
        let formValues = {};
        let totalAmountPrice = 0;

        // Product Selection Constructor
        function ProductSelection(productData) {
        console.log('Product Data:',productData)
          this.id = productData.id;
          this.title = productData.title;
          this.description = productData.description || '';
          this.featuredImage = productData.featuredImage;
          this.variants = productData.variants || [];
          this.price = productData.variants && productData.variants[0] ? parseFloat(productData.variants[0].price) : 0;
          this.quantity = 1;
          this.variantId = productData.variants && productData.variants[0] ? productData.variants[0].id : null;
          
          // Method to get total price for this product
          this.getTotalPrice = function() {
            return this.price * this.quantity;
          };
          
          // Method to increment quantity
          this.incrementQuantity = function() {
            this.quantity += 1;
          };
          
          // Method to decrement quantity
          this.decrementQuantity = function() {
            if (this.quantity > 1) {
              this.quantity -= 1;
              return true;
            }
            return false;
          };
          
          // Method to create HTML representation
          this.createHTML = function() {
            return \`
              <div class="card">
                <img src="\${this.featuredImage}" alt="\${this.title}" />
                <h4>\${this.title}</h4>
                <p>\${this.description.substring(0, 100)}\${this.description.length > 100 ? '...' : ''}</p>
                <p class="price">$\${this.price.toFixed(2)}</p>
                <div class="quantity-controls">
                  <button onclick="minusToSelection('\${this.id}')">-</button>
                  <span class="quantity-display" id="quantity-\${this.id}">\${this.quantity}</span>
                  <button onclick="addToSelection('\${this.id}')">+</button>
                </div>
              </div>
            \`;
          };
          
          // Method to create selected item HTML
          this.createSelectedHTML = function() {
            return \`
              <div class="selected-item">
                <strong>\${this.title}</strong> x\${this.quantity}
                <button onclick="removeFromSelection('\${this.id}')">×</button>
              </div>
            \`;
          };
        }

        // Selection Manager Constructor
        function SelectionManager() {
          this.items = new Map();
          
          // Add or update product in selection
          this.addProduct = function(productData) {
            const productId = productData.id;
            
            if (this.items.has(productId)) {
              // Product exists, increment quantity
              const existingProduct = this.items.get(productId);
              existingProduct.incrementQuantity();
            } else {
              // Create new product selection
              const newProduct = new ProductSelection(productData);
              this.items.set(productId, newProduct);
            }
            
            this.updateDisplay();
            addDescount();
          };
          
          // Remove product from selection
          this.removeProduct = function(productId) {
            this.items.delete(productId);
            this.updateDisplay();
            addDescount();
          };
          
          // Decrement product quantity
          this.decrementProduct = function(productId) {
            if (this.items.has(productId)) {
              const product = this.items.get(productId);
              const canDecrement = product.decrementQuantity();
              
              if (!canDecrement) {
                this.items.delete(productId);
              }
              
              this.updateDisplay();
              addDescount();
            }
          };
          
          // Get total price
          this.getTotalPrice = function() {
            let total = 0;
            for (const product of this.items.values()) {
              total += product.getTotalPrice();
            }
            return total;
          };
          
          // Get total quantity
          this.getTotalQuantity = function() {
            let total = 0;
            for (const product of this.items.values()) {
              total += product.quantity;
            }
            return total;
          };
          
          // Get cart items for Shopify - EXACT FORMAT AS REFERENCE
       this.getCartItems = function() {
          const cartItems = [];
          for (const product of this.items.values()) {
            if (product.variantId) {
              // convert gid://shopify/ProductVariant/45034835116228 → 45034835116228
              const numericId = product.variantId.toString().replace('gid://shopify/ProductVariant/', '');
              cartItems.push({
                id: parseInt(numericId),
                quantity: product.quantity
              });
            }
          }
          return cartItems;
        };

          
          // Update display
          this.updateDisplay = function() {
            const container = document.getElementById("selectedItems");
            const totalPriceElem = document.getElementById("totalPrice");
            
            container.innerHTML = "";
            let total = 0;
            
            for (const product of this.items.values()) {
              total += product.getTotalPrice();
              container.innerHTML += product.createSelectedHTML();
            }
            
            totalAmountPrice = total;
            totalPriceElem.textContent = total.toFixed(2);
            
            // Update quantity displays in product cards
            this.items.forEach((product, productId) => {
              const quantityElem = document.getElementById(\`quantity-\${productId}\`);
              if (quantityElem) {
                quantityElem.textContent = product.quantity;
              }
            });
          };
          
          // Clear all selections
          this.clear = function() {
            this.items.clear();
            this.updateDisplay();
            addDescount();
          };
        }

        // Initialize Selection Manager
        const selectionManager = new SelectionManager();

        function renderStep() {
          const step = steps[currentStep];
          document.getElementById("stepTitle").innerText = step.title;
          const container = document.getElementById("stepContainer");
          container.innerHTML = "";

          if (step.type === "products") {
            const list = document.createElement("div");
            list.className = "product-list";
            
            step.items.forEach(product => {
              const productSelection = new ProductSelection(product);
              list.innerHTML += productSelection.createHTML();
            });
            
            container.appendChild(list);
          }

          if (step.type === "form") {
            const form = document.createElement("div");
            form.className = "form-container";
            step.fields.forEach(field => {
              const wrapper = document.createElement("div");
              wrapper.className = "form-field";
              let fieldHTML = \`<label>\${field.label}</label><br />\`;
              if (field.type === "textarea") {
                fieldHTML += \`<textarea name="\${field.name}" placeholder="\${field.placeholder}">\${formValues[field.name] || ""}</textarea>\`;
              } else {
                fieldHTML += \`<input type="text" name="\${field.name}" placeholder="\${field.placeholder}" value="\${formValues[field.name] || ""}" />\`;
              }
              wrapper.innerHTML = fieldHTML;
              form.appendChild(wrapper);
            });
            form.querySelectorAll("input, textarea").forEach(input => {
              input.addEventListener("input", (e) => {
                formValues[e.target.name] = e.target.value;
              });
            });
            container.appendChild(form);
          }
          
          selectionManager.updateDisplay();
        }

        function addToSelection(productId) {
          const step = steps[currentStep];
          const product = step.items.find(p => p.id === productId);
          if (product) {
            selectionManager.addProduct(product);
          }
        }

        function minusToSelection(productId) {
          selectionManager.decrementProduct(productId);
        }

        function removeFromSelection(productId) {
          selectionManager.removeProduct(productId);
        }

        function goNext() {
          if (currentStep < steps.length - 1) {
            currentStep++;
            renderStep();
            updateNavigationButtons();
          } else {
            document.getElementById('AddToCartBtn').style.visibility = 'visible';
            updateNavigationButtons();
          }
        }

        function goBack() {
          if (currentStep > 0) {
            currentStep--;
            renderStep();
            updateNavigationButtons();
          }
        }

        function updateNavigationButtons() {
          const backBtn = document.getElementById('backBtn');
          const nextBtn = document.getElementById('nextBtn');
          
          backBtn.disabled = currentStep === 0;
          nextBtn.disabled = currentStep === steps.length - 1;
          
          if (currentStep === steps.length - 1) {
            nextBtn.style.display = 'none';
          } else {
            nextBtn.style.display = 'inline-block';
          }
        }

        // Add to Cart Function - EXACTLY LIKE REFERENCE
        function addToCart() {
          const cartItems = selectionManager.getCartItems();
          const messageContainer = document.getElementById('messageContainer');
          const addToCartBtn = document.getElementById('AddToCartBtn');
          
          if (cartItems.length === 0) {
            showMessage('Please select at least one product', 'error');
            return;
          }

          // Show loading state
          addToCartBtn.classList.add('loading');
          addToCartBtn.disabled = true;
          addToCartBtn.textContent = 'Adding to Cart...';

          // Prepare formData EXACTLY like reference
          const formData = {
            'items': cartItems
          };

          // EXACT fetch call like reference
          fetch(window.Shopify.routes.root + 'cart/add.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
          })
          .then(response => {
            return response.json();
          })
          .then(data => {
            // Success
            showMessage('Items added to cart successfully! Redirecting to cart...', 'success');
            
            // Redirect to cart page after short delay
            setTimeout(() => {
              window.location.href = window.Shopify.routes.root + 'cart';
            }, 1000);
          })
          .catch((error) => {
            console.error('Error:', error);
            showMessage('Error adding items to cart. Please try again.', 'error');
          })
          .finally(() => {
            // Reset button state
            addToCartBtn.classList.remove('loading');
            addToCartBtn.disabled = false;
            addToCartBtn.textContent = 'Add to Cart';
          });
        }

        // Show message to user
        function showMessage(message, type = 'info') {
          const messageContainer = document.getElementById('messageContainer');
          messageContainer.innerHTML = \`
            <div class="\${type}-message">
              \${message}
            </div>
          \`;
          
          // Auto hide after 5 seconds
          if (type === 'error') {
            setTimeout(() => {
              messageContainer.innerHTML = '';
            }, 5000);
          }
        }

        function addDescount() {
          const totalQuantity = selectionManager.getTotalQuantity();
          const totalAmount = selectionManager.getTotalPrice();
          
          descountArry.sort((a, b) => a.min - b.min);
          let discount = 0;
          
          if (descountType === 'Total Quantity') {
            for (let i = 0; i < descountArry.length; i++) {
              if (totalQuantity >= descountArry[i].min) discount = descountArry[i].dsp;
            }
          }
          
          if (descountType === 'Total Amount') {
            for (let i = 0; i < descountArry.length; i++) {
              if (totalAmount >= descountArry[i].min) discount = descountArry[i].dsp;
            }
          }
          
          document.getElementById("descountApply").innerHTML = discount;
          const discountedPrice = totalAmount - (totalAmount * discount / 100);
          document.getElementById("afterDescountTotelPrice").innerHTML = discountedPrice.toFixed(2);
        }

        // Initialize
        renderStep();
        updateNavigationButtons();
        
        const descountSection = document.getElementById("descountSection");
        descountSection.innerHTML = "<h4>Discount Rules</h4><p>Discount type: " + descountType + "</p>";
        descountArry.forEach(descount => {
          descountSection.innerHTML += "<p>Minimum " + (descountType === 'Total Quantity' ? 'Quantity' : 'Amount') + ": " + descount.min + " - Discount: " + descount.dsp + "% </p>";
        });
      </script>
    </div>`;

  const response = await admin.graphql(
    `#graphql
      mutation CreatePage($page: PageCreateInput!) {
        pageCreate(page: $page) {
          page { id title handle }
          userErrors { code field message }
        }
      }`,
    { variables: { page: { title: pageTitle, body: fullPage, isPublished: true, templateSuffix: "custom" } } }
  );
  const responseJson = await response.json();
  return { pageTitle, pageBody, responseJson };
};

export default function CreatePage() {
  const { products: storeProducts, session } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState([
    {
      type: "products",
      title: "Step 1: Choose Products",
      items: []
    }
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [createdPageHandle, setCreatedPageHandle] = useState("");
  const [pageCreated, setPageCreated] = useState(false);

  const handleChangePageTitle = useCallback((newValue) => setTitle(newValue), []);
  const handleSearchChange = useCallback((newValue) => setSearchQuery(newValue), []);

  // Filter products based on search
  const filteredProducts = storeProducts.filter(product =>
    product.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Add new step
  const addStep = useCallback(() => {
    setSteps(prev => [
      ...prev,
      {
        type: "products",
        title: `Step ${prev.length + 1}: New Step`,
        items: []
      }
    ]);
  }, []);

  // Remove step
  const removeStep = useCallback((index) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Update step type
  const updateStepType = useCallback((index, newType) => {
    setSteps(prev => prev.map((step, i) => {
      if (i === index) {
        if (newType === "form" && step.type !== "form") {
          return {
            ...step,
            type: "form",
            fields: [
              { label: "Field 1", placeholder: "Enter text", name: "field1" }
            ]
          };
        } else if (newType === "products" && step.type !== "products") {
          return {
            ...step,
            type: "products",
            items: []
          };
        }
        return { ...step, type: newType };
      }
      return step;
    }));
  }, []);

  // Update step title
  const updateStepTitle = useCallback((index, newTitle) => {
    setSteps(prev => prev.map((step, i) => 
      i === index ? { ...step, title: newTitle } : step
    ));
  }, []);

  // Add product to step
  const addProductToStep = useCallback((stepIndex, product) => {
    setSteps(prev => prev.map((step, i) => {
      if (i === stepIndex && step.type === "products") {
        // Check if product already exists in this step
        const productExists = step.items.some(item => item.id === product.id);
        if (!productExists) {
          return {
            ...step,
            items: [...step.items, product]
          };
        }
      }
      return step;
    }));
  }, []);

  // Remove product from step
  const removeProductFromStep = useCallback((stepIndex, productId) => {
    setSteps(prev => prev.map((step, i) => {
      if (i === stepIndex && step.type === "products") {
        return {
          ...step,
          items: step.items.filter(item => item.id !== productId)
        };
      }
      return step;
    }));
  }, []);

  // Add field to form step
  const addFieldToStep = useCallback((stepIndex) => {
    setSteps(prev => prev.map((step, i) => {
      if (i === stepIndex && step.type === "form") {
        return {
          ...step,
          fields: [
            ...step.fields,
            { label: `Field ${step.fields.length + 1}`, placeholder: "Enter text", name: `field${step.fields.length + 1}` }
          ]
        };
      }
      return step;
    }));
  }, []);

  // Update field in form step
  const updateFieldInStep = useCallback((stepIndex, fieldIndex, field, value) => {
    setSteps(prev => prev.map((step, i) => {
      if (i === stepIndex && step.type === "form") {
        const updatedFields = step.fields.map((fieldObj, j) => {
          if (j === fieldIndex) {
            return { ...fieldObj, [field]: value };
          }
          return fieldObj;
        });
        return { ...step, fields: updatedFields };
      }
      return step;
    }));
  }, []);

  // Remove field from form step
  const removeFieldFromStep = useCallback((stepIndex, fieldIndex) => {
    setSteps(prev => prev.map((step, i) => {
      if (i === stepIndex && step.type === "form") {
        return {
          ...step,
          fields: step.fields.filter((_, j) => j !== fieldIndex)
        };
      }
      return step;
    }));
  }, []);

  const createPageFun = () => {
    const formData = new FormData();
    formData.append("title", title);
    formData.append("body", JSON.stringify(steps));
    submit(formData, { method: "post", action: "/app/createPage" });
  };

  useEffect(() => {
    if (actionData?.responseJson?.data?.pageCreate?.page?.handle) {
      setTitle("");
      setSteps([
        {
          type: "products",
          title: "Step 1: Choose Products",
          items: []
        }
      ]);
      setCreatedPageHandle(actionData.responseJson.data.pageCreate.page.handle);
      setPageCreated(true);
    }
  }, [actionData]);

  return (
    <Page>
      <TitleBar title="Create Dynamic Steps Page" />
      <Layout>
        <Layout.Section>
          <div style={{ textAlign: "end", marginBottom: "20px" }}>
            <Link url="/app/allCreatedPages" removeUnderline>
              <Button variant="primary">All Pages List</Button>
            </Link>
          </div>
          <Card>
            <BlockStack gap="300">
              <TextField
                label="Page title"
                value={title}
                onChange={handleChangePageTitle}
                autoComplete="off"
              />
              
              <Text variant="headingMd" as="h2">Steps Configuration</Text>
              
              {steps.map((step, stepIndex) => (
                <Card key={stepIndex} sectioned>
                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <Text variant="headingSm" as="h3">Step {stepIndex + 1}</Text>
                      <Button 
                        variant="plain" 
                        icon={DeleteIcon} 
                        onClick={() => removeStep(stepIndex)}
                        disabled={steps.length === 1}
                      >
                        Remove Step
                      </Button>
                    </InlineStack>
                    
                    <TextField
                      label="Step Title"
                      value={step.title}
                      onChange={(value) => updateStepTitle(stepIndex, value)}
                      autoComplete="off"
                    />
                    
                    <Select
                      label="Step Type"
                      options={[
                        { label: "Products Selection", value: "products" },
                        { label: "Form", value: "form" },
                      ]}
                      value={step.type}
                      onChange={(value) => updateStepType(stepIndex, value)}
                    />
                    
                    {step.type === "products" && (
                      <BlockStack gap="200">
                        <Text variant="headingXs" as="h4">Selected Products for this Step</Text>
                        
                        {/* Selected Products List */}
                        {step.items.length > 0 ? (
                          <List>
                            {step.items.map((product) => (
                              <List.Item key={product.id}>
                                <InlineStack align="space-between" blockAlign="center">
                                  <InlineStack gap="200" blockAlign="center">
                                    <Thumbnail
                                      source={product.featuredImage}
                                      alt={product.title}
                                      size="small"
                                    />
                                    <div>
                                      <Text variant="bodyMd" as="p" fontWeight="bold">{product.title}</Text>
                                      <Text variant="bodySm" as="p">
                                        ${product.variants[0]?.price || '0.00'}
                                      </Text>
                                    </div>
                                  </InlineStack>
                                  <Button
                                    variant="plain"
                                    icon={DeleteIcon}
                                    onClick={() => removeProductFromStep(stepIndex, product.id)}
                                  >
                                    Remove
                                  </Button>
                                </InlineStack>
                              </List.Item>
                            ))}
                          </List>
                        ) : (
                          <Banner status="info">
                            <Text variant="bodySm" as="p">No products selected for this step. Use the product selector below to add products.</Text>
                          </Banner>
                        )}

                        {/* Product Search and Selection */}
                        <Card subdued>
                          <BlockStack gap="200">
                            <Text variant="headingXs" as="h4">Add Products from Store</Text>
                            <TextField
                              label="Search Products"
                              value={searchQuery}
                              onChange={handleSearchChange}
                              autoComplete="off"
                              prefix={<Icon source={SearchIcon} />}
                              placeholder="Search products by name..."
                            />
                            
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                              <List>
                                {filteredProducts.map((product) => {
                                  const isSelected = step.items.some(item => item.id === product.id);
                                  return (
                                    <List.Item key={product.id}>
                                      <InlineStack align="space-between" blockAlign="center">
                                        <InlineStack gap="200" blockAlign="center">
                                          <Thumbnail
                                            source={product.featuredImage}
                                            alt={product.title}
                                            size="small"
                                          />
                                          <div>
                                            <Text variant="bodyMd" as="p" fontWeight="bold">{product.title}</Text>
                                            <Text variant="bodySm" as="p">
                                              ${product.variants[0]?.price || '0.00'}
                                              {product.variants[0]?.inventoryQuantity && (
                                                <Badge tone="success">In stock: {product.variants[0].inventoryQuantity}</Badge>
                                              )}
                                            </Text>
                                          </div>
                                        </InlineStack>
                                        <Button
                                          variant={isSelected ? "primary" : "secondary"}
                                          disabled={isSelected}
                                          onClick={() => addProductToStep(stepIndex, product)}
                                        >
                                          {isSelected ? 'Added' : 'Add to Step'}
                                        </Button>
                                      </InlineStack>
                                    </List.Item>
                                  );
                                })}
                              </List>
                            </div>
                          </BlockStack>
                        </Card>
                      </BlockStack>
                    )}
                    
                    {step.type === "form" && (
                      <BlockStack gap="200">
                        <InlineStack align="space-between">
                          <Text variant="headingXs" as="h4">Form Fields</Text>
                          <Button variant="plain"  onClick={() => addFieldToStep(stepIndex)}>
                            Add Field
                          </Button>
                        </InlineStack>
                        
                        {step.fields.map((field, fieldIndex) => (
                          <Card key={fieldIndex} subdued>
                            <BlockStack gap="200">
                              <InlineStack align="space-between">
                                <Text variant="bodyMd" as="p"><strong>Field {fieldIndex + 1}</strong></Text>
                                <Button 
                                  variant="plain" 
                                  icon={DeleteIcon} 
                                  onClick={() => removeFieldFromStep(stepIndex, fieldIndex)}
                                  disabled={step.fields.length === 1}
                                >
                                  Remove
                                </Button>
                              </InlineStack>
                              
                              <TextField
                                label="Field Label"
                                value={field.label}
                                onChange={(value) => updateFieldInStep(stepIndex, fieldIndex, 'label', value)}
                                autoComplete="off"
                              />
                              
                              <TextField
                                label="Placeholder"
                                value={field.placeholder}
                                onChange={(value) => updateFieldInStep(stepIndex, fieldIndex, 'placeholder', value)}
                                autoComplete="off"
                              />
                              
                              <TextField
                                label="Field Name"
                                value={field.name}
                                onChange={(value) => updateFieldInStep(stepIndex, fieldIndex, 'name', value)}
                                autoComplete="off"
                              />
                              
                              <Select
                                label="Field Type"
                                options={[
                                  { label: "Text", value: "text" },
                                  { label: "Textarea", value: "textarea" },
                                ]}
                                value={field.type || "text"}
                                onChange={(value) => updateFieldInStep(stepIndex, fieldIndex, 'type', value)}
                              />
                            </BlockStack>
                          </Card>
                        ))}
                      </BlockStack>
                    )}
                  </BlockStack>
                </Card>
              ))}
              
              <Button variant="plain"  onClick={addStep}>
                Add New Step
              </Button>
              
              <Button variant="primary" onClick={createPageFun}>
                Create page
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Banner>
                Your store link -{" "}
                <Link url={`https://${session.shop}`} target="_blank">
                  Go to Store
                </Link>
              </Banner>
            </BlockStack>
          </Card>
          <br />
          {pageCreated && (
            <Card>
              <BlockStack gap="200">
                <Banner>
                  Your created page store link -{" "}
                  <Link
                    url={`https://${session.shop}/pages/${createdPageHandle}`}
                    target="_blank"
                  >
                    Go to Store new page
                  </Link>
                </Banner>
              </BlockStack>
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
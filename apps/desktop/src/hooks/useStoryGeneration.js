import { useState, useEffect } from 'react';

export function useStoryGeneration({
  topic,
  numSlides,
  selectedStyle,
  imageSize,
  imageProvider,
  llmProvider = 'gemini',
  inputMode,
  pastedText,
  brandId,
  onSaveResearch,
  onSaveImages
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingPhase, setGeneratingPhase] = useState(null);
  const [storyPlan, setStoryPlan] = useState(null);
  const [expectedSlides, setExpectedSlides] = useState(0);
  const [currentGeneratingSlide, setCurrentGeneratingSlide] = useState(0);
  const [generatingSlides, setGeneratingSlides] = useState([]);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [generatedSlides, setGeneratedSlides] = useState([]);
  const [storyCaption, setStoryCaption] = useState('');
  const [storyHashtags, setStoryHashtags] = useState([]);
  const [completedResearch, setCompletedResearch] = useState(null);
  const [researchCollapsed, setResearchCollapsed] = useState(true);

  // Cycle through slides during generation
  useEffect(() => {
    if (generatingPhase === 'images' && currentGeneratingSlide < expectedSlides) {
      const timer = setTimeout(() => {
        setCurrentGeneratingSlide(prev => Math.min(prev + 1, expectedSlides));
      }, 12000);
      return () => clearTimeout(timer);
    }
  }, [generatingPhase, currentGeneratingSlide, expectedSlides]);

  // Build aesthetic string from JSON style
  const buildAestheticString = (style) => {
    if (!style) return '';
    return `${style.art_style || ''} with ${style.color_palette || ''}, ${style.lighting || ''}, ${style.texture || ''}, ${style.typography_style || ''}, ${style.background_style || ''}`;
  };

  const handleGenerate = async (e) => {
    e.preventDefault();

    if (inputMode === 'topic' && !topic) return;
    if (inputMode === 'paste' && !pastedText.trim()) return;

    setIsGenerating(true);
    setGeneratingPhase('research');
    setGeneratedImages([]);
    setGeneratedSlides([]);
    setStoryCaption('');
    setStoryHashtags([]);
    setStoryPlan(null);
    setCompletedResearch(null);
    setResearchCollapsed(true);

    // Build aesthetic from selected style
    const aestheticString = buildAestheticString(selectedStyle);

    try {
      let response;

      // Get user-selected Ollama model from localStorage
      const ollamaModel = localStorage.getItem('narrativ_ollama_model') || '';

      if (inputMode === 'paste') {
        response = await fetch('http://127.0.0.1:8000/plan_from_text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: pastedText,
            num_slides: numSlides,
            aesthetic: aestheticString,
            topic: topic || 'Custom Content',
            image_size: imageSize,
            llm_provider: llmProvider,
            ollama_model: ollamaModel
          }),
        });
      } else {
        response = await fetch('http://127.0.0.1:8000/plan_story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic,
            num_slides: numSlides,
            aesthetic: aestheticString,
            image_size: imageSize,
            llm_provider: llmProvider,
            ollama_model: ollamaModel
          }),
        });
      }

      if (!response.ok) throw new Error('Planning failed');

      const data = await response.json();

      // Override aesthetic with selected style if available
      if (selectedStyle && data.plan) {
        data.plan.aesthetic = {
          art_style: selectedStyle.art_style,
          color_palette: selectedStyle.color_palette,
          lighting: selectedStyle.lighting,
          texture: selectedStyle.texture,
          typography_style: selectedStyle.typography_style,
          background_style: selectedStyle.background_style
        };
        data.plan.style_name = selectedStyle.name;
      }

      setStoryPlan(data.plan);
    } catch (err) {
      console.error(err);
      alert("Failed to plan story. Check backend.");
    } finally {
      setIsGenerating(false);
      setGeneratingPhase(null);
    }
  };

  const handleConfirmPlan = async (filteredPlan = null) => {
    // Use filtered plan if provided, otherwise use full storyPlan
    const planToUse = filteredPlan || storyPlan;
    console.log('[useStoryGeneration] handleConfirmPlan called:', {
      hasFilteredPlan: !!filteredPlan,
      filteredSlideCount: filteredPlan?.slides?.length,
      planToUseSlideCount: planToUse?.slides?.length
    });
    if (!planToUse) return;

    // Save FULL research (all slides) before generating
    const newResearchBoard = {
      id: Date.now(),
      topic: storyPlan.topic,
      aesthetic: storyPlan.aesthetic,
      style_name: storyPlan.style_name,
      slides: storyPlan.slides, // Save ALL slides in research
      sources: storyPlan.sources,
      caption: storyPlan.caption,
      hashtags: storyPlan.hashtags,
      image_size: storyPlan.image_size || imageSize,
      provider: storyPlan.provider || llmProvider,
      model: storyPlan.model,
      createdAt: new Date().toISOString()
    };
    onSaveResearch(newResearchBoard);
    setCompletedResearch(storyPlan);

    setIsGenerating(true);
    setGeneratingPhase('images');
    // Use filtered plan's slide count for progress
    setExpectedSlides(planToUse.slides?.length || 0);
    setGeneratingSlides(planToUse.slides || []);
    setCurrentGeneratingSlide(1);

    try {
      // Use filtered plan for image generation
      const planWithSize = {
        ...planToUse,
        image_size: imageSize || planToUse.image_size || 'story'
      };

      // Get HuggingFace quality mode from localStorage
      const hfQualityMode = localStorage.getItem('narrativ_hf_quality_mode') || 'free';

      const response = await fetch('http://127.0.0.1:8000/generate_from_plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planWithSize,
          provider: imageProvider,
          brand_id: brandId || null,
          hf_quality_mode: hfQualityMode,
        }),
      });

      if (!response.ok) throw new Error('Generation failed');

      const data = await response.json();

      // Only save images if we got some
      if (data.images && data.images.length > 0) {
        setGeneratedImages(data.images);
        setGeneratedSlides(planToUse.slides); // Use filtered slides
        setStoryCaption(storyPlan.caption || '');
        setStoryHashtags(storyPlan.hashtags || []);
        setResearchCollapsed(true);

        const newImageBoard = {
          id: Date.now(),
          topic: storyPlan.topic,
          images: data.images,
          slides: planToUse.slides, // Save only generated slides
          caption: storyPlan.caption,
          hashtags: storyPlan.hashtags,
          aesthetic: planToUse.aesthetic || storyPlan.aesthetic,
          style_name: planToUse.style_name || storyPlan.style_name,
          image_size: planToUse.image_size || imageSize,
          provider: imageProvider,
          createdAt: new Date().toISOString()
        };

        onSaveImages(newImageBoard);
        setStoryPlan(null);
        return newImageBoard;
      } else {
        // No images generated, but research is saved
        alert("No images were generated. Research has been saved - you can try again from the Boards.");
        setStoryPlan(null);
        return null;
      }
    } catch (err) {
      console.error(err);
      alert("Image generation failed. Research has been saved - you can try again from the Boards.");
      setStoryPlan(null);
      return null;
    } finally {
      setIsGenerating(false);
      setGeneratingPhase(null);
    }
  };

  const handleRegenerateImages = async (researchToUse = null) => {
    const research = researchToUse || completedResearch;
    if (!research) return;

    setCompletedResearch(research);
    setIsGenerating(true);
    setGeneratingPhase('images');
    setExpectedSlides(research.slides?.length || 0);
    setGeneratingSlides(research.slides || []);
    setCurrentGeneratingSlide(1);
    setResearchCollapsed(true);

    try {
      // Apply current selectedStyle if available, otherwise use research's aesthetic
      const currentAesthetic = selectedStyle ? {
        art_style: selectedStyle.art_style,
        color_palette: selectedStyle.color_palette,
        lighting: selectedStyle.lighting,
        texture: selectedStyle.texture,
        typography_style: selectedStyle.typography_style,
        background_style: selectedStyle.background_style
      } : research.aesthetic;

      // Ensure image_size is included and use current aesthetic
      const planWithSize = {
        ...research,
        aesthetic: currentAesthetic,
        style_name: selectedStyle?.name || research.style_name,
        image_size: imageSize || research.image_size || 'story'
      };

      // Get HuggingFace quality mode from localStorage
      const hfQualityMode = localStorage.getItem('narrativ_hf_quality_mode') || 'free';

      const response = await fetch('http://127.0.0.1:8000/generate_from_plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planWithSize,
          provider: imageProvider,
          hf_quality_mode: hfQualityMode,
        }),
      });

      if (!response.ok) throw new Error('Regeneration failed');

      const data = await response.json();
      setGeneratedImages(data.images);
      setGeneratedSlides(research.slides);
      setStoryCaption(research.caption || '');
      setStoryHashtags(research.hashtags || []);

      const newImageBoard = {
        id: Date.now(),
        topic: research.topic,
        images: data.images,
        slides: research.slides,
        caption: research.caption,
        hashtags: research.hashtags,
        aesthetic: currentAesthetic,
        style_name: selectedStyle?.name || research.style_name,
        image_size: research.image_size || imageSize,
        provider: imageProvider,
        createdAt: new Date().toISOString()
      };

      onSaveImages(newImageBoard);

      return newImageBoard;
    } catch (err) {
      console.error(err);
      alert("Failed to regenerate images.");
      return null;
    } finally {
      setIsGenerating(false);
      setGeneratingPhase(null);
    }
  };

  const handleEditAesthetic = (field, value) => {
    if (!storyPlan) return;
    setStoryPlan({
      ...storyPlan,
      aesthetic: { ...storyPlan.aesthetic, [field]: value }
    });
  };

  const handleEditSlide = (slideIndex, field, value) => {
    if (!storyPlan) return;
    const updatedSlides = [...storyPlan.slides];
    updatedSlides[slideIndex] = { ...updatedSlides[slideIndex], [field]: value };
    setStoryPlan({ ...storyPlan, slides: updatedSlides });
  };

  const handleDeleteSlide = (slideIndex) => {
    if (!storyPlan || storyPlan.slides.length <= 1) return;
    const updatedSlides = storyPlan.slides.filter((_, idx) => idx !== slideIndex);
    // Renumber slides
    updatedSlides.forEach((slide, idx) => {
      slide.slide_number = idx + 1;
    });
    setStoryPlan({ ...storyPlan, slides: updatedSlides });
  };

  const handleAddSlide = () => {
    if (!storyPlan || storyPlan.slides.length >= 10) return;
    const newSlideNumber = storyPlan.slides.length + 1;
    const newSlide = {
      slide_number: newSlideNumber,
      title: 'New Scene',
      key_fact: 'Add your fact here...',
      visual_description: 'Describe the visual scene...'
    };
    setStoryPlan({ ...storyPlan, slides: [...storyPlan.slides, newSlide] });
  };

  const handleEditCaption = (value) => {
    if (!storyPlan) return;
    setStoryPlan({ ...storyPlan, caption: value });
  };

  const handleCancel = () => {
    setIsGenerating(false);
    setGeneratingPhase(null);
    setStoryPlan(null);
  };

  // Update plan aesthetic when style changes during generation
  const updatePlanStyle = (newStyle) => {
    if (storyPlan && newStyle) {
      setStoryPlan({
        ...storyPlan,
        aesthetic: {
          art_style: newStyle.art_style,
          color_palette: newStyle.color_palette,
          lighting: newStyle.lighting,
          texture: newStyle.texture,
          typography_style: newStyle.typography_style,
          background_style: newStyle.background_style
        },
        style_name: newStyle.name
      });
    }
  };

  return {
    isGenerating,
    generatingPhase,
    storyPlan,
    setStoryPlan,
    expectedSlides,
    currentGeneratingSlide,
    setCurrentGeneratingSlide,
    generatingSlides,
    generatedImages,
    generatedSlides,
    storyCaption,
    storyHashtags,
    completedResearch,
    setCompletedResearch,
    researchCollapsed,
    setResearchCollapsed,
    handleGenerate,
    handleConfirmPlan,
    handleRegenerateImages,
    handleEditAesthetic,
    handleEditSlide,
    handleDeleteSlide,
    handleAddSlide,
    handleEditCaption,
    handleCancel,
    updatePlanStyle
  };
}
